# ---------------------------------------------------------
# Base Stage
# ---------------------------------------------------------
FROM python:3.11-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    procps \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

ENV HF_HOME=/app/.cache/huggingface

# ---------------------------------------------------------
# Development Stage
# ---------------------------------------------------------
FROM base AS development

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["tail", "-f", "/dev/null"]

# ---------------------------------------------------------
# Production Stage
# ---------------------------------------------------------
FROM base AS production

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]