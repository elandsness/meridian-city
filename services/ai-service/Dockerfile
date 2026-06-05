FROM python:3.12-slim AS base

WORKDIR /app

# ---------------------------------------------------------------------------
# Python deps (cached layer)
# ---------------------------------------------------------------------------
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------------------------------------------------------------------------
# Application code
# ---------------------------------------------------------------------------
COPY ai_service/ ./ai_service/

EXPOSE 8085

# Run with uvicorn; FastAPI lifecycle hooks initialise OTel and the LLM client
CMD ["python", "-m", "ai_service.main"]
