"""
WhatsApp handler - sends a web link via Twilio WhatsApp API.
Since WhatsApp calls cannot be initiated programmatically, we send the person
a message with a LiveKit room link so they can join and talk to the AI agent.
"""
import logging
import os

from twilio.rest import Client

logger = logging.getLogger("whatsapp-handler")


def send_whatsapp_call_invite(
    whatsapp_number: str,
    room_url: str,
    agent_name: str = "AI Assistant",
    message_body: str | None = None,
) -> dict:
    """
    Send a WhatsApp message with a link to join a LiveKit AI call.
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")

    if not account_sid or not auth_token:
        raise ValueError(
            "Twilio credentials not configured. "
            "Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env"
        )

    # Normalize number
    if not whatsapp_number.startswith("whatsapp:"):
        if not whatsapp_number.startswith("+"):
            whatsapp_number = f"+{whatsapp_number}"
        whatsapp_number = f"whatsapp:{whatsapp_number}"

    body = message_body or (
        f"Hi! *{agent_name}* would like to connect with you for a call. "
        f"Click the link below to join the audio/video session:\n\n"
        f"{room_url}\n\n"
        f"_This call is powered by an AI assistant. Tap the link to start._"
    )

    client = Client(account_sid, auth_token)
    message = client.messages.create(
        body=body,
        from_=from_number,
        to=whatsapp_number,
    )

    logger.info(f"WhatsApp invite sent to {whatsapp_number}, SID: {message.sid}")
    return {
        "message_sid": message.sid,
        "status": message.status,
        "to": whatsapp_number,
        "room_url": room_url,
    }
