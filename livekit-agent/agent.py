import os
import asyncio
import logging
from pathlib import Path
from livekit import rtc, api
from livekit.api import TwirpError
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool
from livekit.plugins import google
from google.genai import types as genai_types
from google.protobuf.duration_pb2 import Duration
import httpx

logger = logging.getLogger("ana-agent")

SYSTEM_PROMPT = Path(__file__).parent.joinpath("system-prompt.txt").read_text()
CALENDAR_URL = os.environ["CALENDAR_ENDPOINT"]
CALENDAR_SECRET = os.environ["WEBHOOK_SECRET"]
TRANSFER_TO_NUMBER = os.environ.get("TRANSFER_TO_NUMBER", "+351931822816")
TRANSFER_FALLBACK_URL = os.environ.get("TRANSFER_FALLBACK_ENDPOINT")

# Outbound trunk for attended ("warm") transfer — set once the +351 number
# and outbound SIP trunk exist (see setup_sip.py). Without it, transfer_to_human
# falls back to a blind SIP REFER (no voicemail/no-answer detection).
OUTBOUND_TRUNK_ID = os.environ.get("OUTBOUND_TRUNK_ID")
TRANSFER_RING_TIMEOUT_S = int(os.environ.get("TRANSFER_RING_TIMEOUT_S", "20"))
TRANSFER_CALLER_ID_NAME = os.environ.get("TRANSFER_CALLER_ID_NAME", "Ana - Voice Demo")


def _find_sip_participant(room: rtc.Room) -> rtc.RemoteParticipant | None:
    for p in room.remote_participants.values():
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            return p
    return None


async def _transfer_failed(caller_phone: str, reason: str) -> str:
    """Notify Raphael via WhatsApp that a transfer didn't go through, and return
    the line Ana should say to the caller."""
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
            headers={"x-vapi-secret": CALENDAR_SECRET},
            timeout=10,
        )
        data = r.json()

    if data.get("success"):
        return f"Done! Meeting booked for {data['meetingTime']}."
    return "I couldn't complete the booking. Please contact Raphael at raphaelbruno.dev@gmail.com."


async def entrypoint(ctx: JobContext):
    await ctx.connect()

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
            # legs hear each other directly. Give Ana a moment to say goodbye
            # before the agent steps out.
            logger.info("transfer_to_human: Raphael answered, agent leaving room")

            async def _delayed_shutdown():
                await asyncio.sleep(4)
                ctx.shutdown(reason="warm transfer completed")

            asyncio.create_task(_delayed_shutdown())
            return "Transferência concluída — o colega já está em linha. Despede-te brevemente, a Ana vai sair da chamada de seguida."

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

    model = google.beta.realtime.RealtimeModel(
        model="gemini-2.5-flash-native-audio-latest",
        voice="Aoede",
        language="pt-PT",
        api_key=os.environ["GEMINI_API_KEY"],
        instructions=SYSTEM_PROMPT,
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
        instructions=SYSTEM_PROMPT,
        tools=[book_meeting, transfer_to_human],
    )
    session = AgentSession(llm=model)
    await session.start(agent, room=ctx.room)

    await session.generate_reply(
        instructions="Greet the caller warmly in European Portuguese: 'Olá! Sou a Ana, uma demonstração ao vivo de um agente de IA criado por Raphael Bruno. Como posso ajudar?' Then wait for their response."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(
        entrypoint_fnc=entrypoint,
        agent_name="ana-agent",
        # Keep 2 warm processes so concurrent calls don't pay process-spawn
        # latency; shed new jobs once average load passes 75%.
        num_idle_processes=2,
        load_threshold=0.75,
    ))
