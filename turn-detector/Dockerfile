# ── Stage 1: download model weights at build time ────────────────────────────
# Baking the model into the image avoids cold-start download latency.
# The ~135 MB model_en.onnx is cached in the image layer and never re-downloaded
# unless you rebuild (e.g. after a NAMO model update).
FROM python:3.11-slim AS downloader

RUN pip install --no-cache-dir huggingface_hub==0.26.2 transformers==4.46.3

# Download NAMO English model from HuggingFace
RUN python -c "\
from huggingface_hub import hf_hub_download; \
import os; \
os.makedirs('/models', exist_ok=True); \
hf_hub_download( \
    repo_id='videosdk-live/NAMO-Turn-Detector-v1', \
    filename='model_en.onnx', \
    local_dir='/models', \
); \
print('NAMO model downloaded')"

# Save DistilBERT tokenizer locally (no network needed at runtime)
RUN python -c "\
from transformers import AutoTokenizer; \
AutoTokenizer.from_pretrained('distilbert-base-uncased').save_pretrained('/models/tokenizer'); \
print('Tokenizer saved')"

# ── Stage 2: minimal runtime image ───────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy model artifacts from the downloader stage (no HuggingFace at runtime)
COPY --from=downloader /models /models

COPY main.py .

ENV MODEL_DIR=/models
ENV CONFIDENCE_THRESHOLD=0.65

EXPOSE 8080

# Single worker — the model is not thread-safe for writes; reads are fine.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--log-level", "info"]
