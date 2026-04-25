"""
Semantic Turn Detector — FastAPI sidecar service.

Uses a fast linguistic heuristic (no model download needed) to predict whether
the user's accumulated ASR text represents a complete turn. Sub-millisecond
latency, runs on any CPU, zero build-time dependencies.

The Go pipeline calls POST /predict with the latest transcript. If
turn_complete=true and confidence >= threshold, it fires the LLM immediately
instead of waiting for the silence-based debounce timer.

Accuracy vs. pure silence:
  - Catches "yes / no / okay / sure" → fires in <5ms (vs 900ms)
  - Holds on trailing "and / but / so / because" → waits correctly
  - Handles sentence-ending punctuation when Deepgram emits it
  - Falls back to 150ms timer for ambiguous cases

Optional ONNX upgrade path:
  Set MODEL_PATH=/models/model_en.onnx in env and mount a pre-downloaded
  NAMO or LiveKit turn-detector ONNX file. The service will load it and
  use ONNX inference instead of heuristics automatically.
"""

import os
import logging
import time
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [turn-detector] %(message)s")
log = logging.getLogger(__name__)

CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.65"))
MODEL_PATH = os.getenv("MODEL_PATH", "")  # optional: path to ONNX model file

# ── Optional ONNX model (loaded if MODEL_PATH is set and file exists) ─────────
ort_session = None
ort_tokenizer = None
ort_input_names: list[str] = []


def _try_load_onnx():
    global ort_session, ort_tokenizer, ort_input_names
    if not MODEL_PATH or not os.path.exists(MODEL_PATH):
        return False
    try:
        import onnxruntime as ort
        from transformers import AutoTokenizer

        tokenizer_path = os.path.join(os.path.dirname(MODEL_PATH), "tokenizer")
        tok_id = tokenizer_path if os.path.isdir(tokenizer_path) else "distilbert-base-uncased"

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 2
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess = ort.InferenceSession(MODEL_PATH, sess_options=opts,
                                    providers=["CPUExecutionProvider"])
        tok = AutoTokenizer.from_pretrained(tok_id)

        ort_session = sess
        ort_tokenizer = tok
        ort_input_names = [i.name for i in sess.get_inputs()]
        log.info("ONNX model loaded from %s (inputs: %s)", MODEL_PATH, ort_input_names)
        return True
    except Exception as e:
        log.warning("Could not load ONNX model, falling back to heuristic: %s", e)
        return False


def _onnx_infer(text: str) -> float:
    import numpy as np
    enc = ort_tokenizer(text, return_tensors="np", truncation=True,
                        max_length=128, padding="max_length")
    feeds = {n: enc[n].astype(np.int64) for n in ort_input_names if n in enc}
    out = ort_session.run(None, feeds)
    raw = float(out[0].flatten()[0])
    return 1.0 / (1.0 + __import__("math").exp(-raw))  # sigmoid


# ── Linguistic heuristic (no model required) ─────────────────────────────────

# Single-word/short-phrase completions common in voice conversations
_DONE = {
    "yes", "no", "okay", "ok", "sure", "right", "correct", "exactly",
    "absolutely", "definitely", "certainly", "yeah", "yep", "nope", "yea",
    "thanks", "thank you", "bye", "goodbye", "done", "fine", "good", "great",
    "perfect", "understood", "agreed", "noted", "alright", "go ahead",
    "sounds good", "makes sense", "i see", "got it", "got it thanks",
    "no problem", "no worries", "of course", "not really", "not exactly",
}

# Trailing function words that strongly signal the sentence is not finished
_INCOMPLETE_ENDING = {
    "and", "but", "or", "so", "because", "since", "while", "although",
    "however", "therefore", "the", "a", "an", "to", "for", "in", "on",
    "at", "by", "with", "about", "from", "of", "as", "like", "that",
    "this", "these", "those", "my", "our", "your", "his", "her", "their",
    "its", "also", "just", "even", "then", "when", "where", "how", "what",
    "which", "who", "if", "whether", "both", "either", "not", "very",
    "really", "more", "most", "some", "any", "all", "each", "every",
    "will", "would", "could", "should", "can", "may", "might", "shall",
    "must", "have", "has", "had", "do", "does", "did", "be", "been",
    "being", "am", "is", "are", "was", "were", "i", "we", "they",
    "he", "she", "it", "you", "then",
}


def heuristic_infer(text: str) -> float:
    """
    Returns P(turn_complete) in [0.0, 1.0].

    The heuristic beats pure-silence detection on:
      - Short completions ("yes", "no", "okay") → fires in ~5ms vs 900ms
      - Trailing incomplete words ("and", "but", ...) → correctly holds
      - Terminal punctuation (`.?!`) when Deepgram emits it → immediate fire
      - Long utterances (≥10 words) → highly likely complete

    Falls back to 150ms timer (the Go-side EndpointDebounce) when uncertain.
    """
    text = text.strip()
    if not text:
        return 0.0

    lower = text.lower()
    words = lower.split()
    n = len(words)
    raw_last = text[-1]
    last_word = words[-1].rstrip(".,!?;:") if words else ""

    # ── Terminal punctuation (strong) ─────────────────────────────────────
    if raw_last in "?!":
        return 0.92
    if raw_last == ".":
        return 0.87
    # Comma → listing continues
    if raw_last == ",":
        return 0.09

    # ── Canonical short completions ────────────────────────────────────────
    clean = lower.rstrip(" .,!?")
    if clean in _DONE or any(clean.endswith(d) for d in _DONE if len(d) > 4):
        return 0.94

    # ── Incomplete trailing word ───────────────────────────────────────────
    if last_word in _INCOMPLETE_ENDING:
        return 0.12

    # ── Sentence length → confidence curve ────────────────────────────────
    # Empirically tuned for Deepgram Nova-2 short utterances:
    if n >= 15:
        return 0.85
    if n >= 10:
        return 0.78
    if n >= 7:
        return 0.70
    if n >= 5:
        return 0.62
    if n >= 3:
        return 0.50
    if n == 2:
        return 0.42
    # Single word, not in completions → uncertain
    return 0.35


def infer(text: str) -> float:
    if ort_session is not None:
        return _onnx_infer(text)
    return heuristic_infer(text)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if _try_load_onnx():
        log.info("Using ONNX model for turn detection.")
    else:
        log.info(
            "Using linguistic heuristic for turn detection "
            "(set MODEL_PATH=/path/to/model.onnx to enable ONNX)."
        )
    log.info("Turn detector ready. threshold=%.2f", CONFIDENCE_THRESHOLD)
    yield


app = FastAPI(title="Turn Detector", lifespan=lifespan)


# ── Schemas ────────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    text: str


class PredictResponse(BaseModel):
    turn_complete: bool
    confidence: float
    latency_ms: float
    backend: str  # "onnx" or "heuristic"


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    text = req.text.strip()
    if not text:
        return PredictResponse(turn_complete=False, confidence=0.0,
                               latency_ms=0.0, backend="heuristic")
    t0 = time.perf_counter()
    confidence = infer(text)
    latency_ms = (time.perf_counter() - t0) * 1000

    backend = "onnx" if ort_session is not None else "heuristic"
    turn_complete = confidence >= CONFIDENCE_THRESHOLD

    log.debug("predict(%r) → complete=%s conf=%.3f lat=%.2fms [%s]",
              text[:70], turn_complete, confidence, latency_ms, backend)

    return PredictResponse(
        turn_complete=turn_complete,
        confidence=round(confidence, 4),
        latency_ms=round(latency_ms, 3),
        backend=backend,
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "backend": "onnx" if ort_session is not None else "heuristic",
        "threshold": CONFIDENCE_THRESHOLD,
    }
