FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# IMPORTANT Railway-light:
# Install CPU-only PyTorch wheels FIRST. Without this, a normal Linux pip
# resolution can pull very large CUDA/NVIDIA runtime packages into the image.
RUN python -m pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.8.0 torchaudio==2.8.0 torchvision==0.23.0

COPY requirements.txt .

# WhisperX sees the already-installed compatible CPU PyTorch stack and does not
# need to pull CUDA PyTorch wheels.
RUN python -m pip install --no-cache-dir -r requirements.txt \
    && find /usr/local/lib/python3.11/site-packages -type d -name "__pycache__" -prune -exec rm -rf {} + \
    && find /root/.cache -mindepth 1 -delete 2>/dev/null || true

COPY main.py .

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
