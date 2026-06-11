import json
import os
import asyncio
import logging
from pathlib import Path
from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool
from livekit.plugins import google
from google.genai import types as genai_types
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
CALENDAR_URL = os.environ["CALENDAR_ENDPOINT"]
CALENDAR_SECRET = os.environ["WEBHOOK_SECRET"]
TRANSFER_TO_NUMBER = os.environ.get("TRANSFER_TO_NUMBER", "+351931822816")
TRANSFER_FALLBACK_URL = os.environ.get("TRANSFER_FALLBACK_ENDPOINT")


def _find_sip_participant(room: rtc.Room) -> rtc.RemoteParticipant | None:
    for p in room.remote_participants.values():
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            return p
    return None


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
            headers={"x-vapi-secret": CALENDAR_SECRET},
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

    state: dict = {"lead_context": await _resolve_lead_context(ctx), "agent": None}

    instructions = SYSTEM_PROMPT + "\n\n" + (
        render_lead_context_block(state["lead_context"])
        if state["lead_context"]
        else UNIDENTIFIED_LEAD_INSTRUCTIONS
    )

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

        logger.info("transfer_to_human: reason=%s participant=%s", reason, sip_participant.identity)

        try:
            await ctx.transfer_sip_participant(
                sip_participant,
                TRANSFER_TO_NUMBER,
                play_dialtone=True,
            )
            return "Transferência iniciada com sucesso."
        except Exception:
            logger.exception("transfer_to_human failed")
            if TRANSFER_FALLBACK_URL:
                try:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            TRANSFER_FALLBACK_URL,
                            json={
                                "callerPhone": sip_participant.attributes.get("sip.phoneNumber", "desconhecido"),
                                "reason": reason,
                            },
                            headers={"x-vapi-secret": CALENDAR_SECRET},
                            timeout=10,
                        )
                except Exception:
                    logger.exception("transfer fallback notification failed")
            return (
                "A transferência falhou tecnicamente. Pede desculpa ao utilizador, "
                "diz que o Raphael vai ligar de volta em breve, e confirma o número de telefone dele."
            )

    model = google.beta.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-latest",
        voice="Aoede",
        language="pt-PT",
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
        tools=[book_meeting, transfer_to_human, lookup_lead_by_name, wrap_up_call],
    )
    state["agent"] = agent
    session = AgentSession(llm=model)
    await session.start(agent, room=ctx.room)

    lead_context = state["lead_context"]
    if lead_context:
        greeting_instructions = (
            "Greet the caller warmly in European Portuguese, mentioning their business by name: "
            f"'Olá! Daqui é a Ana, do Raphael Bruno. Falas da {lead_context['name']}, certo?' "
            "Then wait for their response."
        )
    else:
        greeting_instructions = (
            "Greet the caller warmly in European Portuguese: 'Olá! Sou a Ana, uma demonstração ao vivo de um agente "
            "de IA criado por Raphael Bruno. Como posso ajudar?' Then wait for their response."
        )

    await session.generate_reply(instructions=greeting_instructions)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="ana-agent"))
