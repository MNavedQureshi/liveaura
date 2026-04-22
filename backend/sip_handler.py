"""
SIP/Phone call handler using LiveKit SIP trunking.
Requires a SIP trunk configured in your LiveKit project (Twilio, Vonage, etc.)
"""
import logging
import os

from livekit.api import LiveKitAPI
from livekit.api.sip_service import (
    CreateSIPParticipantRequest,
)

logger = logging.getLogger("sip-handler")


async def dispatch_phone_call(
    room_name: str,
    phone_number: str,
    caller_id: str | None = None,
    display_name: str = "AI Assistant",
) -> dict:
    """
    Initiate an outbound SIP call to a phone number and add it to a LiveKit room.
    The AI agent must already be dispatched to the room before calling this.
    """
    sip_trunk_id = os.getenv("SIP_TRUNK_ID", "")
    if not sip_trunk_id:
        raise ValueError(
            "SIP_TRUNK_ID not configured. "
            "Set up a SIP trunk in your LiveKit dashboard and add the ID to .env"
        )

    # Normalize phone number to E.164 format
    if not phone_number.startswith("+"):
        phone_number = f"+{phone_number}"

    async with LiveKitAPI() as lk:
        participant = await lk.sip.create_sip_participant(
            CreateSIPParticipantRequest(
                sip_trunk_id=sip_trunk_id,
                sip_call_to=phone_number,
                room_name=room_name,
                participant_identity=f"phone-{phone_number.replace('+', '')}",
                participant_name=display_name,
                play_dialtone=True,
            )
        )

    logger.info(f"SIP call dispatched to {phone_number} in room {room_name}")
    return {
        "participant_id": participant.participant_id,
        "phone_number": phone_number,
        "room_name": room_name,
    }
