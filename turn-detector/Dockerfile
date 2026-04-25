# Turn Detector sidecar — lightweight FastAPI service.
#
# Default mode: pure linguistic heuristic (no model files, <10s build).
#   - Sub-millisecond latency
#   - No HuggingFace account needed
#   - ~80MB image (python:3.11-slim + fastapi + uvicorn)
#
# ONNX mode (optional): mount a pre-downloaded turn-detector ONNX file and
# set MODEL_PATH=/models/model.onnx. The service will automatically switch to
# ONNX inference. Supported models:
#   - NAMO-Turn-Detector-v1 (videosdk-live/NAMO-Turn-Detector-v1, requires approval)
#   - LiveKit turn-detector  (livekit/turn-detector on HuggingFace)
# To pre-download: huggingface-cli download <repo_id> model_en.onnx --local-dir ./models
# Then: docker compose run --rm -v ./models:/models turn-detector env MODEL_PATH=/models/model_en.onnx

FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir fastapi==0.115.5 "uvicorn[standard]==0.32.1"

COPY main.py .

ENV CONFIDENCE_THRESHOLD=0.65
ENV MODEL_PATH=""

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", \
     "--workers", "1", "--log-level", "info"]
