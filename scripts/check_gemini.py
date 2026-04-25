#!/usr/bin/env python3
"""
Check Gemini API key and diagnose "limit reached" errors.

Usage:
  GEMINI_API_KEY=AIza... python3 check_gemini.py
  GEMINI_API_KEY=AIza... python3 check_gemini.py gemini-1.5-flash
  GEMINI_API_KEY=AIza... python3 check_gemini.py --burst 12     # fire 12 quick calls

Reports:
  - Whether the key works at all
  - The exact quota that triggered the limit (RPM / TPM / RPD)
  - Which model is being used
  - Headers that reveal current usage
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if not API_KEY:
    sys.exit("ERROR: set GEMINI_API_KEY (or GOOGLE_API_KEY) env var first.\n"
             "  PowerShell: $env:GEMINI_API_KEY='AIza...'\n"
             "  bash:       export GEMINI_API_KEY=AIza...")

MODEL = "gemini-2.0-flash"
BURST = 1
for i, arg in enumerate(sys.argv[1:]):
    if arg == "--burst" and i + 2 <= len(sys.argv) - 1:
        BURST = int(sys.argv[i + 2])
    elif not arg.startswith("--"):
        MODEL = arg

BASE = "https://generativelanguage.googleapis.com/v1beta"


def call(model: str, prompt: str = "Say 'pong' and nothing else.") -> tuple[int, dict, dict]:
    """Returns (status_code, response_body_json, headers_dict)."""
    url = f"{BASE}/models/{model}:generateContent?key={API_KEY}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 20},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            body_json = json.loads(body)
        except json.JSONDecodeError:
            body_json = {"raw": body}
        return e.code, body_json, dict(e.headers or {})


def list_models() -> list:
    """Call /v1beta/models to confirm the key is valid + see what's available."""
    url = f"{BASE}/models?key={API_KEY}"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read())
            return data.get("models", [])
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return [{"_error": f"HTTP {e.code}: {body[:300]}"}]


def banner(text: str) -> None:
    print(f"\n=== {text} ===")


# ── 1. Validate key ──────────────────────────────────────────────────────────
banner("Step 1: validate API key (list models)")
models = list_models()
if models and "_error" in models[0]:
    print(f"FAIL: {models[0]['_error']}")
    print("\nLikely causes:")
    print("  - Key is invalid or revoked")
    print("  - Generative Language API not enabled on this project")
    print("  - Wrong project (key tied to project without billing/API access)")
    sys.exit(1)
print(f"OK — key valid. {len(models)} models accessible.")
flash_models = [m["name"].split("/")[-1] for m in models if "flash" in m.get("name", "").lower()]
print(f"  Flash variants: {', '.join(flash_models[:5])}")

# ── 2. Single test call ──────────────────────────────────────────────────────
banner(f"Step 2: single call to {MODEL}")
status, body, headers = call(MODEL)
print(f"HTTP {status}")
if status == 200:
    try:
        text = body["candidates"][0]["content"]["parts"][0]["text"].strip()
        print(f"Response: {text!r}")
    except (KeyError, IndexError):
        print(f"Unexpected body: {json.dumps(body, indent=2)[:400]}")
else:
    err = body.get("error", body)
    print(f"Error message : {err.get('message', '<none>')}")
    print(f"Error status  : {err.get('status', '<none>')}")
    print(f"Error code    : {err.get('code', '<none>')}")
    details = err.get("details", [])
    for d in details:
        t = d.get("@type", "")
        if "QuotaFailure" in t:
            print("\n>>> QUOTA FAILURE — exact limit that triggered:")
            for v in d.get("violations", []):
                print(f"    quotaMetric : {v.get('quotaMetric')}")
                print(f"    quotaId     : {v.get('quotaId')}")
                print(f"    description : {v.get('description')}")
        elif "Help" in t:
            for link in d.get("links", []):
                print(f"  Help: {link.get('description')} → {link.get('url')}")
        elif "RetryInfo" in t:
            print(f"  Retry after : {d.get('retryDelay')}")

# Headers Google sometimes returns
interesting = {k: v for k, v in headers.items() if "rate" in k.lower() or "quota" in k.lower() or "retry" in k.lower()}
if interesting:
    banner("Rate-limit headers")
    for k, v in interesting.items():
        print(f"  {k}: {v}")

# ── 3. Optional burst test ────────────────────────────────────────────────────
if BURST > 1:
    banner(f"Step 3: burst {BURST} calls to find the RPM ceiling")
    t0 = time.time()
    success = fail = 0
    first_fail_at = None
    for i in range(BURST):
        s, b, _ = call(MODEL, prompt=f"Reply with the digit {i % 10}.")
        if s == 200:
            success += 1
            print(f"  [{i + 1:>3}] OK")
        else:
            fail += 1
            err_msg = b.get("error", {}).get("message", str(b))[:80]
            print(f"  [{i + 1:>3}] HTTP {s}: {err_msg}")
            if first_fail_at is None:
                first_fail_at = i + 1
    dt = time.time() - t0
    print(f"\nResult: {success}/{BURST} OK in {dt:.1f}s ({success / dt * 60:.1f} req/min)")
    if first_fail_at:
        print(f"First failure at request #{first_fail_at} — your effective RPM ceiling.")

# ── 4. Quick guidance ────────────────────────────────────────────────────────
banner("What to do next")
if status == 200:
    print(f"  Key works for {MODEL}. If your app still hits limits:")
    print("  - You're likely exceeding 10 RPM (gemini-2.0-flash) or 1500 RPD")
    print("  - Run again with --burst 15 to confirm the RPM cap")
    print("  - For voice (1 req per turn), consider Cerebras free tier (30 RPM)")
elif status == 429:
    print("  Quota exhausted. Wait for the window to reset:")
    print("  - RPM resets every 60 seconds")
    print("  - RPD resets at midnight Pacific time")
    print("  - Or switch to a less-loaded model (gemini-1.5-flash-8b)")
elif status in (401, 403):
    print("  Key invalid / API not enabled.")
    print("  Visit: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com")
else:
    print(f"  Unexpected status {status}. Full body:")
    print(json.dumps(body, indent=2)[:600])
