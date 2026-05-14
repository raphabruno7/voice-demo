import os
import asyncio
from pathlib import Path
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli, function_tool
from livekit.plugins.openai import realtime
from openai.types.realtime.realtime_audio_input_turn_detection import ServerVad
import httpx

SYSTEM_PROMPT = Path(__file__).parent.joinpath("system-prompt.txt").read_text()
CALENDAR_URL = os.environ["CALENDAR_ENDPOINT"]
CALENDAR_SECRET = os.environ["WEBHOOK_SECRET"]


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

    model = realtime.RealtimeModel(
        model="grok-voice-latest",
        base_url="https://api.x.ai/v1/realtime",
        api_key=os.environ["XAI_API_KEY"],
        voice="eve",
        instructions=SYSTEM_PROMPT,
        temperature=0.3,
        max_response_output_tokens=150,
        turn_detection=ServerVad(
            type="server_vad",
            threshold=0.5,
            prefix_padding_ms=300,
            silence_duration_ms=500,
        ),
    )

    agent = Agent(
        instructions=SYSTEM_PROMPT,
        tools=[book_meeting],
    )
    session = AgentSession(llm=model)
    await session.start(agent, room=ctx.room)

    await session.generate_reply(
        instructions="Greet the caller warmly in European Portuguese: 'Olá! Sou a Ana, uma demonstração ao vivo de um agente de IA criado por Raphael Bruno. Como posso ajudar?' Then wait for their response."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name="ana-agent"))
