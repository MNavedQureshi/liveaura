"""
FastAPI backend server for AI Calling Agent
Provides REST API for room creation, token generation, and call dispatching.
"""
import json
import logging
import os
import secrets
import string
import time
from contextlib import asynccontextmanager
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from livekit.api import AccessToken, VideoGrants
from livekit.api import LiveKitAPI
from livekit.api.room_service import CreateRoomRequest
from pydantic import BaseModel

load_dotenv()
logger = logging.getLogger("server")
logging.basicConfig(level=logging.INFO)

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
APP_URL = os.getenv("NEXT_PUBLIC_APP_URL", "http://localhost:3000")

# In-memory call registry (use Redis/DB in production)
active_calls: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    active_calls.clear()


app = FastAPI(title="AI Calling Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", APP_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Models ---

class CreateCallRequest(BaseModel):
    call_type: str  # "web" | "phone" | "whatsapp"
    agent_name: str = "AI Assistant"
    prompt: str
    presentation_script: Optional[str] = None
    phone_number: Optional[str] = None
    whatsapp_number: Optional[str] = None
    greeting: Optional[str] = None
    video_enabled: bool = False


class TokenRequest(BaseModel):
    room_name: str
    identity: str
    can_publish: bool = True


# --- Helpers ---

def generate_room_name() -> str:
    chars = string.ascii_lowercase + string.digits
    suffix = "".join(secrets.choice(chars) for _ in range(8))
    return f"ai-call-{suffix}"


def build_livekit_token(
    room_name: str,
    identity: str,
    name: str = "",
    can_publish: bool = True,
    ttl: int = 3600,
) -> str:
    token = AccessToken(api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET)
    token.with_identity(identity)
    token.with_name(name or identity)
    token.with_ttl(ttl)
    token.with_grants(
        VideoGrants(
            room_join=True,
            room=room_name,
            can_publish=can_publish,
            can_subscribe=True,
        )
    )
    return token.to_jwt()


async def create_room_with_metadata(room_name: str, metadata: dict) -> None:
    async with LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    ) as lk:
        await lk.room.create_room(
            CreateRoomRequest(
                name=room_name,
                metadata=json.dumps(metadata),
                empty_timeout=300,
                max_participants=10,
            )
        )


async def dispatch_agent(room_name: str) -> None:
    """Trigger the LiveKit agent worker to join the room."""
    dispatch_url = os.getenv("AGENT_DISPATCH_URL", "")
    if dispatch_url:
        async with httpx.AsyncClient() as client:
            await client.post(
                dispatch_url,
                json={"room": room_name},
                headers={"Authorization": f"Bearer {LIVEKIT_API_KEY}"},
                timeout=10,
            )
    else:
        # Agent worker auto-picks up rooms when running via `python agent.py start`
        logger.info(f"Agent will auto-connect to room: {room_name}")


# --- Routes ---

@app.get("/api/health")
def health():
    return {"status": "ok", "calls": len(active_calls)}


@app.post("/api/calls")
async def create_call(req: CreateCallRequest):
    room_name = generate_room_name()
    room_url = f"{APP_URL}/room/{room_name}"

    metadata = {
        "call_type": req.call_type,
        "agent_name": req.agent_name,
        "prompt": req.prompt,
        "greeting": req.greeting or f"Hello! I'm {req.agent_name}. How can I help you today?",
        "video_enabled": req.video_enabled,
    }
    if req.presentation_script:
        metadata["presentation_script"] = req.presentation_script

    # Create the LiveKit room
    await create_room_with_metadata(room_name, metadata)

    # Dispatch AI agent to the room
    await dispatch_agent(room_name)

    call_record = {
        "room_name": room_name,
        "room_url": room_url,
        "call_type": req.call_type,
        "agent_name": req.agent_name,
        "status": "created",
        "created_at": int(time.time()),
    }

    # Handle phone call (SIP outbound)
    if req.call_type == "phone" and req.phone_number:
        try:
            from sip_handler import dispatch_phone_call
            sip_result = await dispatch_phone_call(
                room_name=room_name,
                phone_number=req.phone_number,
                display_name=req.agent_name,
            )
            call_record["phone_number"] = req.phone_number
            call_record["sip_participant_id"] = sip_result.get("participant_id")
            call_record["status"] = "calling"
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"SIP call failed: {e}")
            raise HTTPException(status_code=500, detail=f"Phone call failed: {str(e)}")

    # Handle WhatsApp (send invite message)
    elif req.call_type == "whatsapp" and req.whatsapp_number:
        try:
            from whatsapp_handler import send_whatsapp_call_invite
            wa_result = send_whatsapp_call_invite(
                whatsapp_number=req.whatsapp_number,
                room_url=room_url,
                agent_name=req.agent_name,
            )
            call_record["whatsapp_number"] = req.whatsapp_number
            call_record["whatsapp_message_sid"] = wa_result.get("message_sid")
            call_record["status"] = "invite_sent"
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            logger.error(f"WhatsApp invite failed: {e}")
            raise HTTPException(status_code=500, detail=f"WhatsApp invite failed: {str(e)}")

    active_calls[room_name] = call_record
    return call_record


@app.post("/api/token")
async def get_token(req: TokenRequest):
    token = build_livekit_token(
        room_name=req.room_name,
        identity=req.identity,
        name=req.identity,
        can_publish=req.can_publish,
    )
    return {
        "token": token,
        "livekit_url": LIVEKIT_URL,
        "room_name": req.room_name,
    }


@app.get("/api/calls")
def list_calls():
    return list(active_calls.values())


@app.get("/api/calls/{room_name}")
def get_call(room_name: str):
    call = active_calls.get(room_name)
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    return call


@app.delete("/api/calls/{room_name}")
async def end_call(room_name: str):
    if room_name not in active_calls:
        raise HTTPException(status_code=404, detail="Call not found")

    try:
        async with LiveKitAPI(
            url=LIVEKIT_URL,
            api_key=LIVEKIT_API_KEY,
            api_secret=LIVEKIT_API_SECRET,
        ) as lk:
            await lk.room.delete_room(room_name)
    except Exception as e:
        logger.warning(f"Could not delete room {room_name}: {e}")

    active_calls.pop(room_name, None)
    return {"status": "ended", "room_name": room_name}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
