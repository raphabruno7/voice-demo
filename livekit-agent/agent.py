import json
import os
import asyncio
import logging
import threading
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from http.server import BaseHTTPRequestHandler, HTTPServer
from livekit import rtc, api
from livekit.api import TwirpError
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool
from livekit.plugins import google
from google.genai import types as genai_types
from google.protobuf.duration_pb2 import Duration
import httpx

from arcus_lookup import (
    UNIDENTIFIED_LEAD_INSTRUCTIONS,
    build_lead_context,
    lookup_by_company_name,
    lookup_by_phone,
    log_voice_interaction,
    render_lead_context_block,
    update_contact_after_voice_call,
)

logger = logging.getLogger("ana-agent")

SYSTEM_PROMPT = Path(__file__).parent.joinpath("system-prompt.txt").read_text()
CONFIRMATION_PROMPT_TEMPLATE = Path(__file__).parent.joinpath("system-prompt-confirmation.txt").read_text()
CALENDAR_URL = os.environ["CALENDAR_ENDPOINT"]
CALENDAR_SECRET = os.environ["WEBHOOK_SECRET"]
TRANSFER_TO_NUMBER = os.environ.get("TRANSFER_TO_NUMBER", "+351931822816")
TRANSFER_FALLBACK_URL = os.environ.get("TRANSFER_FALLBACK_ENDPOINT")

# Outbound confirmation/reschedule/cancel calls reuse the same Next.js host as
# CALENDAR_ENDPOINT (e.g. https://voice-demo-navy.vercel.app/api/book-meeting).
_APP_BASE_URL = CALENDAR_URL.rsplit("/api/", 1)[0]
APPOINTMENTS_CONFIRM_URL = f"{_APP_BASE_URL}/api/appointments/confirm"
APPOINTMENTS_RESCHEDULE_URL = f"{_APP_BASE_URL}/api/appointments/reschedule"
APPOINTMENTS_CANCEL_URL = f"{_APP_BASE_URL}/api/appointments/cancel"
APPOINTMENTS_OPT_OUT_URL = f"{_APP_BASE_URL}/api/appointments/opt-out"

_PT_WEEKDAYS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
_PT_MONTHS = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def _format_pt_datetime(iso: str) -> str:
    """Formats an ISO datetime as a pt-PT phrase, e.g. 'terça-feira, 16 de junho, às 15:00'."""
    if not iso:
        return ""
    dt = datetime.fromisoformat(iso)
    dt = dt.astimezone(ZoneInfo("Europe/Lisbon")) if dt.tzinfo else dt.replace(tzinfo=ZoneInfo("Europe/Lisbon"))
    return f"{_PT_WEEKDAYS[dt.weekday()]}, {dt.day} de {_PT_MONTHS[dt.month - 1]}, às {dt.strftime('%H:%M')}"

# Outbound trunk for attended ("warm") transfer — set once the +351 number
# and outbound SIP trunk exist (see setup_sip.py). Without it, transfer_to_human
# falls back to a blind SIP REFER (no voicemail/no-answer detection).
OUTBOUND_TRUNK_ID = os.environ.get("OUTBOUND_TRUNK_ID")
TRANSFER_RING_TIMEOUT_S = int(os.environ.get("TRANSFER_RING_TIMEOUT_S", "20"))
TRANSFER_CALLER_ID_NAME = os.environ.get("TRANSFER_CALLER_ID_NAME", "24/7 Voice Agent - Demo")


def _find_sip_participant(room: rtc.Room) -> rtc.RemoteParticipant | None:
    for p in room.remote_participants.values():
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            return p
    return None


async def _transfer_failed(caller_phone: str, reason: str) -> str:
    """Notify Raphael via WhatsApp that a transfer didn't go through, and return
    the line the agent should say to the caller."""
    if TRANSFER_FALLBACK_URL:
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    TRANSFER_FALLBACK_URL,
                    json={"callerPhone": caller_phone, "reason": reason},
                    headers={"x-vapi-secret": CALENDAR_SECRET},
                    timeout=10,
                )
        except Exception:
            logger.exception("transfer fallback notification failed")
    return (
        "A transferência falhou tecnicamente. Pede desculpa ao utilizador, "
        "diz que o Raphael vai ligar de volta em breve, e confirma o número de telefone dele."
    )


@function_tool
async def book_meeting(caller_name: str, start_time: str) -> str:
    """Books a 30-minute demo with Raphael in Google Calendar.

    Use when the caller agrees to schedule a meeting.

    Args:
        caller_name: Full name or first name of the caller.
        start_time: ISO 8601 datetime for the meeting start (e.g. 2026-05-20T10:00:00).
                    Morning = 10:00, Afternoon = 15:00. Base relative dates on today.
    """
    async with httpx.AsyncClient() as client:
        r = await client.post(
            CALENDAR_URL,
            json={"callerName": caller_name, "startTime": start_time},
            headers={"x-hume-secret": CALENDAR_SECRET},
            timeout=10,
        )
        data = r.json()

    if data.get("success"):
        return f"Done! Meeting booked for {data['meetingTime']}."
    return "I couldn't complete the booking. Please contact Raphael at raphaelbruno.dev@gmail.com."


async def _resolve_lead_context(ctx: JobContext) -> dict | None:
    """Identifica o lead desta chamada via SIP caller ID ou room metadata (modo browser)."""
    sip_participant = _find_sip_participant(ctx.room)

    if sip_participant is not None:
        phone = sip_participant.attributes.get("sip.phoneNumber", "")
        if not phone:
            return None
        try:
            contact = await lookup_by_phone(phone)
        except Exception:
            logger.exception("arcus lookup_by_phone failed")
            return None
        return build_lead_context(contact) if contact else None

    # Modo browser/teste: leadPhone passado via room.metadata
    if not ctx.room.metadata:
        return None
    try:
        meta = json.loads(ctx.room.metadata)
    except ValueError:
        return None
    phone = meta.get("leadPhone")
    if not phone:
        return None
    try:
        contact = await lookup_by_phone(phone)
    except Exception:
        logger.exception("arcus lookup_by_phone failed")
        return None
    return build_lead_context(contact) if contact else None


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    job_metadata: dict = {}
    if ctx.job.metadata:
        try:
            job_metadata = json.loads(ctx.job.metadata)
        except (json.JSONDecodeError, TypeError):
            logger.warning("entrypoint: failed to parse job metadata: %r", ctx.job.metadata)

    is_confirmation_call = job_metadata.get("callType") == "confirmation"

    state: dict = {"lead_context": None, "agent": None}

    @function_tool
    async def lookup_lead_by_name(business_name: str) -> str:
        """Procura o negócio do utilizador no CRM pelo nome, para personalizar a conversa.

        Usa esta tool assim que o utilizador disser o nome do negócio dele,
        apenas se ainda não tiveres contexto sobre o negócio.

        Args:
            business_name: Nome do negócio mencionado pelo utilizador.
        """
        try:
            contact = await lookup_by_company_name(business_name)
        except Exception:
            logger.exception("arcus lookup_by_company_name failed")
            return "Não consegui encontrar informação adicional. Continua a conversa normalmente."

        if not contact:
            return "Não encontrei esse negócio no sistema. Continua a conversa normalmente, sem mencionar a pesquisa."

        lead_context = build_lead_context(contact)
        state["lead_context"] = lead_context
        new_instructions = SYSTEM_PROMPT + "\n\n" + render_lead_context_block(lead_context)
        if state["agent"] is not None:
            await state["agent"].update_instructions(new_instructions)

        return (
            f"Encontrei: {lead_context['name']}"
            + (f" ({lead_context['niche_label']})" if lead_context.get("niche_label") else "")
            + f". A partir de agora, personaliza a conversa para a dor: {lead_context.get('pain', '')}. "
            "Continua a conversa de forma natural, sem dizer 'encontrei no sistema'."
        )

    @function_tool
    async def wrap_up_call(intent: str, summary: str) -> str:
        """Regista o resultado da chamada no CRM. Chama esta tool perto do fim da conversa,
        mesmo antes de te despedires, sempre que houver um lead identificado
        (por telefone ou por nome).

        Args:
            intent: Resultado resumido: "agendou_reuniao", "interessado_sem_agendar",
                    "nao_interessado", "pediu_transferencia", "info_apenas".
            summary: Resumo de 1-2 frases da conversa, em português, para o Raphael ler depois.
        """
        lead_context = state.get("lead_context")
        if not lead_context:
            return "Sem lead identificado — nada a registar."

        contact_id = lead_context["contact_id"]
        try:
            await log_voice_interaction(
                contact_id,
                title=f"Demo de voz — {intent}",
                description=summary,
                outcome_type="voice_demo",
            )
            await update_contact_after_voice_call(
                contact_id,
                extra_tags=["voice_demo_done", f"voice_demo_{intent}"],
            )
        except Exception:
            logger.exception("wrap_up_call failed")
            return "Falhou o registo no CRM, mas continua normalmente."

        return "Registado."

    @function_tool
    async def confirm_appointment() -> str:
        """Confirma a marcação do cliente. Usa quando o cliente disser que vai comparecer."""
        async with httpx.AsyncClient() as client:
            r = await client.post(
                APPOINTMENTS_CONFIRM_URL,
                json={"appointmentId": job_metadata.get("appointmentId")},
                headers={"x-vapi-secret": CALENDAR_SECRET},
                timeout=10,
            )
            data = r.json()
        if data.get("success"):
            return "Marcação confirmada com sucesso."
        return "Não foi possível confirmar no sistema, mas regista o pedido do cliente."

    @function_tool
    async def reschedule_appointment(new_start_time: str) -> str:
        """Remarca a marcação do cliente para uma nova data/hora.

        Args:
            new_start_time: Nova data/hora ISO 8601 (ex: 2026-06-17T15:00:00).
        """
        async with httpx.AsyncClient() as client:
            r = await client.post(
                APPOINTMENTS_RESCHEDULE_URL,
                json={"appointmentId": job_metadata.get("appointmentId"), "newStartTime": new_start_time},
                headers={"x-vapi-secret": CALENDAR_SECRET},
                timeout=10,
            )
            data = r.json()
        if data.get("success"):
            return f"Marcação remarcada para {data['meetingTime']}."
        return "Não foi possível remarcar agora. Pede ao cliente para contactar directamente."

    @function_tool
    async def cancel_appointment(reason: str = "") -> str:
        """Cancela a marcação do cliente.

        Args:
            reason: Motivo curto do cancelamento, em português (opcional).
        """
        async with httpx.AsyncClient() as client:
            r = await client.post(
                APPOINTMENTS_CANCEL_URL,
                json={"appointmentId": job_metadata.get("appointmentId"), "reason": reason},
                headers={"x-vapi-secret": CALENDAR_SECRET},
                timeout=10,
            )
            data = r.json()
        if data.get("success"):
            return "Marcação cancelada com sucesso."
        return "Não foi possível cancelar agora. Pede ao cliente para contactar directamente."

    @function_tool
    async def opt_out() -> str:
        """Regista que o cliente não quer receber mais chamadas automáticas de confirmação."""
        async with httpx.AsyncClient() as client:
            await client.post(
                APPOINTMENTS_OPT_OUT_URL,
                json={"appointmentId": job_metadata.get("appointmentId")},
                headers={"x-vapi-secret": CALENDAR_SECRET},
                timeout=10,
            )
        return "Pedido registado — não vai receber mais chamadas automáticas."

    @function_tool
    async def transfer_to_human(reason: str) -> str:
        """Transfere a chamada telefónica em curso para um colega humano.

        Usa esta ferramenta APENAS quando:
        - o utilizador pede explicitamente para falar com uma pessoa/humano/responsável;
        - o pedido é demasiado complexo, técnico ou específico para responderes com confiança
          (ex: questões contratuais, preços fora do que está definido, reclamações);
        - o utilizador está visivelmente insatisfeito, frustrado ou a escalar o tom.

        Não uses para perguntas normais sobre o serviço, agendamentos, ou dúvidas
        que consigas responder com a informação que tens.

        Args:
            reason: Motivo curto da transferência, em português, para contexto interno
                    (ex: "cliente insatisfeito com atraso", "pedido técnico complexo").
        """
        sip_participant = _find_sip_participant(ctx.room)
        if sip_participant is None:
            return (
                "Não foi possível transferir: esta conversa não é uma chamada telefónica "
                "(é uma sessão de browser/demo). Continua a ajudar normalmente."
            )

        caller_phone = sip_participant.attributes.get("sip.phoneNumber", "desconhecido")
        logger.info("transfer_to_human: reason=%s participant=%s", reason, sip_participant.identity)

        if OUTBOUND_TRUNK_ID:
            # Attended transfer: dial Raphael into the room and wait for him to
            # pick up. If it rings out (voicemail/no answer), we never touch the
            # caller's leg — just notify Raphael on WhatsApp instead.
            lkapi = api.LiveKitAPI()
            try:
                await lkapi.sip.create_sip_participant(
                    api.CreateSIPParticipantRequest(
                        sip_trunk_id=OUTBOUND_TRUNK_ID,
                        sip_call_to=TRANSFER_TO_NUMBER,
                        room_name=ctx.room.name,
                        participant_identity="raphael-transfer",
                        participant_name="Raphael",
                        display_name=TRANSFER_CALLER_ID_NAME,
                        wait_until_answered=True,
                        ringing_timeout=Duration(seconds=TRANSFER_RING_TIMEOUT_S),
                        play_dialtone=True,
                    )
                )
            except TwirpError as e:
                logger.warning("transfer_to_human: Raphael did not answer (%s)", e.message)
                return await _transfer_failed(caller_phone, f"{reason} (sem resposta / voicemail)")
            except Exception:
                logger.exception("transfer_to_human: attended dial failed")
                return await _transfer_failed(caller_phone, f"{reason} (erro técnico)")
            finally:
                await lkapi.aclose()

            # Raphael answered and is now in the room with the caller — both
            # legs hear each other directly. Give the agent a moment to say goodbye
            # before the agent steps out.
            logger.info("transfer_to_human: Raphael answered, agent leaving room")

            async def _delayed_shutdown():
                await asyncio.sleep(4)
                ctx.shutdown(reason="warm transfer completed")

            asyncio.create_task(_delayed_shutdown())
            return "Transferência concluída — o colega já está em linha. Despede-te brevemente, o agente vai sair da chamada de seguida."

        # No outbound trunk configured yet — blind SIP REFER (no voicemail detection)
        try:
            await ctx.transfer_sip_participant(
                sip_participant,
                TRANSFER_TO_NUMBER,
                play_dialtone=True,
            )
            return "Transferência iniciada com sucesso."
        except Exception:
            logger.exception("transfer_to_human: blind transfer failed")
            return await _transfer_failed(caller_phone, f"{reason} (falha técnica)")

    if is_confirmation_call:
        appointment_time_pt = _format_pt_datetime(job_metadata.get("appointmentAt", ""))
        instructions = (
            CONFIRMATION_PROMPT_TEMPLATE
            .replace("{client_name}", job_metadata.get("clientName") or "")
            .replace("{appointment_time}", appointment_time_pt)
            .replace("{business_type}", job_metadata.get("businessType") or "marcação")
        )
        agent_tools = [confirm_appointment, reschedule_appointment, cancel_appointment, opt_out]
        greeting_instructions = (
            "Diz exactamente: 'Boa tarde, fala o agente de voz, assistente virtual. É só uma chamada "
            f"automática para confirmar a sua marcação de {appointment_time_pt}. "
            "Vai poder comparecer?' Depois espera pela resposta."
        )
    else:
        state["lead_context"] = await _resolve_lead_context(ctx)
        instructions = SYSTEM_PROMPT + "\n\n" + (
            render_lead_context_block(state["lead_context"])
            if state["lead_context"]
            else UNIDENTIFIED_LEAD_INSTRUCTIONS
        )
        agent_tools = [book_meeting, transfer_to_human, lookup_lead_by_name, wrap_up_call]
        if state["lead_context"]:
            greeting_instructions = (
                "Greet the caller warmly in European Portuguese, mentioning their business by name: "
                f"'Olá! Daqui é o agente de voz do Raphael Bruno. Falas da {state['lead_context']['name']}, certo?' "
                "Then wait for their response."
            )
        else:
            greeting_instructions = (
                "Greet the caller warmly in European Portuguese: 'Olá! Sou um agente de voz, uma demonstração "
                "ao vivo de um agente de IA criado por Raphael Bruno. Como posso ajudar?' "
                "Then wait for their response."
            )

    model = google.beta.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-latest",
        voice="Aoede",
        api_key=os.environ["GEMINI_API_KEY"],
        instructions=instructions,
        temperature=0.3,
        realtime_input_config=genai_types.RealtimeInputConfig(
            automatic_activity_detection=genai_types.AutomaticActivityDetection(
                end_of_speech_sensitivity=genai_types.EndSensitivity.END_SENSITIVITY_HIGH,
                silence_duration_ms=300,
                prefix_padding_ms=100,
            )
        ),
    )

    agent = Agent(
        instructions=instructions,
        tools=agent_tools,
    )
    state["agent"] = agent
    session = AgentSession(llm=model)
    await session.start(agent, room=ctx.room)

    await session.generate_reply(instructions=greeting_instructions)


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # silenciar logs de acesso


def _start_health_server(port: int = 8081) -> None:
    srv = HTTPServer(('', port), _HealthHandler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    logger.info(f"Health server listening on :{port}")


if __name__ == "__main__":
    _start_health_server()
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="ana-agent",
        # Keep 2 warm processes so concurrent calls don't pay process-spawn
        # latency; shed new jobs once average load passes 75%.
        num_idle_processes=2,
        load_threshold=0.75,
    ))
