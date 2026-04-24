"""
NAMO Turn Detector v1 — FastAPI sidecar service.

Loads the VideoSDK NAMO-Turn-Detector-v1 English ONNX model (DistilBERT-based)
and exposes a lightweight HTTP endpoint for the Go pipeline to call.

The Go agent calls POST /predict with the latest accumulated ASR text.
If `turn_complete: true` and `confidence >= 0.65`, it fires the LLM immediately
instead of waiting for the silence-based debounce timer.

Inference time: <20ms on CPU.
Model: videosdk-live/NAMO-Turn-Detector-v1 (model_en.onnx, ~135MB)
Tokenizer: distilbert-base-uncased
"""

import os
import logging
import time
import numpy as np
from contextlib import asynccontextmanager
from typing import Optional

import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [turn-detector] %(message)s")
log = logging.getLogger(__name__)

MODEL_DIR = os.getenv("MODEL_DIR", "/models")
MODEL_PATH = os.path.join(MODEL_DIR, "model_en.onnx")
TOKENIZER_PATH = os.path.join(MODEL_DIR, "tokenizer")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.65"))
MAX_SEQ_LEN = 128

# ── Global state ──────────────────────────────────────────────────────────────
session: Optional[ort.InferenceSession] = None
tokenizer: Optional[AutoTokenizer] = None
input_names: list[str] = []


def load_model():
    global session, tokenizer, input_names

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"NAMO ONNX model not found at {MODEL_PATH}. "
            "Run: huggingface-cli download videosdk-live/NAMO-Turn-Detector-v1 "
            "model_en.onnx --local-dir /models"
        )

    log.info("Loading NAMO model from %s …", MODEL_PATH)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 1
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"])
    input_names = [i.name for i in session.get_inputs()]
    log.info("Model loaded. Input names: %s", input_names)

    log.info("Loading tokenizer from %s …", TOKENIZER_PATH)
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_PATH)
    log.info("Tokenizer ready. Vocab size: %d", tokenizer.vocab_size)

    # Warm-up inference
    _ = _infer("Hello, how are you today?")
    log.info("Warm-up done. Service ready.")


def _infer(text: str) -> float:
    """Run one inference and return P(turn_complete) in [0, 1]."""
    assert session is not None and tokenizer is not None

    enc = tokenizer(
        text,
        return_tensors="np",
        truncation=True,
        max_length=MAX_SEQ_LEN,
        padding="max_length",
    )

    feeds: dict[str, np.ndarray] = {}
    for name in input_names:
        if name in enc:
            feeds[name] = enc[name].astype(np.int64)
        else:
            log.warning("Input %r not in tokenizer output — skipping", name)

    outputs = session.run(None, feeds)
    raw = float(outputs[0].flatten()[0])

    # Convert logit → probability via sigmoid
    prob = 1.0 / (1.0 + np.exp(-raw))
    return prob


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield
    log.info("Shutting down.")


app = FastAPI(title="NAMO Turn Detector", lifespan=lifespan)


# ── Schemas ────────────────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    text: str


class PredictResponse(BaseModel):
    turn_complete: bool
    confidence: float
    latency_ms: float


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if session is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    text = req.text.strip()
    if not text:
        # Empty text — treat as incomplete turn
        return PredictResponse(turn_complete=False, confidence=0.0, latency_ms=0.0)

    t0 = time.perf_counter()
    try:
        confidence = _infer(text)
    except Exception as e:
        log.error("Inference error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    latency_ms = (time.perf_counter() - t0) * 1000

    turn_complete = confidence >= CONFIDENCE_THRESHOLD

    log.debug(
        "predict(%r) → complete=%s conf=%.3f lat=%.1fms",
        text[:80], turn_complete, confidence, latency_ms,
    )

    return PredictResponse(
        turn_complete=turn_complete,
        confidence=round(confidence, 4),
        latency_ms=round(latency_ms, 2),
    )


@app.get("/health")
def health():
    return {
        "status": "ok" if session is not None else "loading",
        "model": "NAMO-Turn-Detector-v1",
        "threshold": CONFIDENCE_THRESHOLD,
    }
