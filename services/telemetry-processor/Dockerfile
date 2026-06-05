FROM python:3.12-slim AS base

# ---------------------------------------------------------------------------
# System deps
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------------------------------------------------------------------------
# Python deps (cached layer)
# ---------------------------------------------------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Application code
# ---------------------------------------------------------------------------
COPY telemetry_processor/ ./telemetry_processor/

EXPOSE 8086

# Run with uvicorn; FastAPI lifecycle hooks start the Kafka consumer
CMD ["python", "-m", "telemetry_processor.main"]
