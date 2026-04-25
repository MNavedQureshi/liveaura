#!/usr/bin/env python3
"""
Check whether your Gemini API key has access to the Live API (real-time voice).

The Live API is a WebSocket endpoint that takes audio in and emits audio out
(or text/audio). It's the architecture Google designed for voice agents:
no separate STT, LLM, TTS — one bidirectional stream.

Usage:
  pip install websockets
  GEMINI_API_KEY=AIza... python3 check_gemini_live.py

Reports for each Live model:
  AVAILABLE   — key works, setup completed
  FORBIDDEN   — key valid but not allowed for this model (tier/region)
  NOT FOUND   — model name doesn't exist in v1beta yet
  ERROR       — other failure (network, quota, etc.)
"""

import asyncio
import json
import os
import sys

try:
    import websockets
except ImportError:
    sys.exit("ERROR: pip install websockets")

API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not API_KEY:
    sys.exit(
        "ERROR: set GEMINI_API_KEY env var first.\n"
        "  PowerShell: $env:GEMINI_API_KEY='AIza...'\n"
        "  bash:       export GEMINI_API_KEY=AIza..."
    )

# All currently advertised Live API models (Sep 2025+).
# Native-audio variants do voice-to-voice; "live" variants are cascade (STT+LLM+TTS chained internally).
MODELS = [
    # Native audio dialog — one model handles voice in + voice out
    "gemini-2.5-flash-preview-native-audio-dialog",
    "gemini-2.5-flash-exp-native-audio-thinking-dialog",
    # Cascade live (faster TTFT, cheaper, less natural prosody)
    "gemini-live-2.5-flash-preview",
    "gemini-2.0-flash-live-001",
    # Older experimental
    "gemini-2.0-flash-exp",
]

URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
    f"?key={API_KEY}"
)


async def check_model(model: str) -> tuple[str, str]:
    """Open a WebSocket, send setup, await setupComplete or error."""
    try:
        async with websockets.connect(URL, ping_interval=None, open_timeout=10) as ws:
            setup = {
                "setup": {
                    "model": f"models/{model}",
                    "generation_config": {"response_modalities": ["TEXT"]},
                }
            }
            await ws.send(json.dumps(setup))

            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=10)
            except asyncio.TimeoutError:
                return ("TIMEOUT", "no response in 10s after setup")

            msg = json.loads(raw) if isinstance(raw, (str, bytes)) and raw else {}
            if "setupComplete" in msg:
                return ("AVAILABLE", "setup OK — voice WebSocket ready")
            if "error" in msg:
                err = msg["error"]
                detail = err.get("message", str(err))
                code = err.get("code", "?")
                return ("ERROR", f"{code}: {detail[:100]}")
            return ("UNKNOWN", str(msg)[:120])

    except websockets.exceptions.InvalidStatusCode as e:
        # 401 = bad key, 403 = forbidden, 404 = model not found
        if e.status_code == 404:
            return ("NOT FOUND", f"model not in v1beta")
        if e.status_code in (401, 403):
            return ("FORBIDDEN", f"HTTP {e.status_code} — billing/tier required")
        return ("HTTP", f"{e.status_code}")
    except websockets.exceptions.ConnectionClosed as e:
        return ("CLOSED", f"code={e.code} reason={e.reason or '<empty>'}"[:120])
    except Exception as e:
        return ("ERROR", f"{type(e).__name__}: {str(e)[:100]}")


async def main():
    print(f"Testing Gemini Live API access for {len(MODELS)} models...\n")
    print(f"{'MODEL':<58} {'STATUS':<14} DETAIL")
    print("-" * 120)

    results = []
    for model in MODELS:
        status, detail = await check_model(model)
        results.append((model, status, detail))
        print(f"{model:<58} {status:<14} {detail}")

    print("\n" + "=" * 70)
    available = [m for m, s, _ in results if s == "AVAILABLE"]
    if available:
        print(f"GOOD NEWS: your key has Live API access on {len(available)} model(s):")
        for m in available:
            print(f"  - {m}")
        print("\nFor a voice agent, recommended order:")
        print("  1. gemini-2.5-flash-preview-native-audio-dialog (most natural)")
        print("  2. gemini-live-2.5-flash-preview (faster, cheaper)")
    else:
        print("No Live API access on free tier with current key.")
        print("Check console.cloud.google.com → enable billing → re-run.")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
