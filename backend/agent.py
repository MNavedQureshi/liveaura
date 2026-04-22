"""
AI Calling Agent - LiveKit Voice/Video Agent
Handles: web calls, phone calls (SIP), WhatsApp-linked calls
"""
import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    JobProcess,
    RoomInputOptions,
    WorkerOptions,
    cli,
)
from livekit.agents.llm import ChatContext
from livekit.plugins import anthropic, cartesia, deepgram, silero

load_dotenv()
logger = logging.getLogger("ai-calling-agent")

DEFAULT_SYSTEM_PROMPT = """You are a professional AI calling agent. You are making a call on behalf of the user.
Be natural, friendly, and conversational. Keep responses concise unless giving a presentation.
Listen carefully to the person you're speaking with and respond appropriately.
You can handle questions, deliver presentations, conduct surveys, or have natural conversations."""


def parse_room_metadata(metadata: str | None) -> dict:
    if not metadata:
        return {}
    try:
        return json.loads(metadata)
    except Exception:
        return {}


class CallingAgent(Agent):
    def __init__(self, instructions: str):
        super().__init__(instructions=instructions)

    async def on_enter(self):
        meta = parse_room_metadata(self.session.room.metadata if self.session else None)
        greeting = meta.get("greeting", "Hello! I'm your AI calling agent. How can I help you today?")
        await self.session.say(greeting, allow_interruptions=True)


async def entrypoint(ctx: JobContext):
    meta = parse_room_metadata(ctx.room.metadata)
    custom_prompt = meta.get("prompt", DEFAULT_SYSTEM_PROMPT)
    agent_name = meta.get("agent_name", "AI Assistant")
    presentation_script = meta.get("presentation_script", "")

    if presentation_script:
        custom_prompt = f"""{custom_prompt}

PRESENTATION SCRIPT TO DELIVER:
{presentation_script}

Deliver this presentation naturally, pausing for questions and engagement from the listener.
"""

    logger.info(f"Starting agent '{agent_name}' in room '{ctx.room.name}'")
    logger.info(f"Call type: {meta.get('call_type', 'web')}")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    session = AgentSession(
        stt=deepgram.STT(model="nova-2", language="en-US"),
        llm=anthropic.LLM(model="claude-sonnet-4-6"),
        tts=cartesia.TTS(voice="a0e99841-438c-4a64-b679-ae501e7d6091"),
        vad=silero.VAD.load(),
        chat_ctx=ChatContext().append(role="system", text=custom_prompt),
    )

    agent = CallingAgent(instructions=custom_prompt)
    await session.start(ctx.room, agent=agent, room_input_options=RoomInputOptions())

    logger.info(f"Agent session started for '{agent_name}'")


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
        )
    )
