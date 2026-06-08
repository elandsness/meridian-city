FROM python:3.12-slim AS base

# Note: no system libpq needed — the service uses asyncpg, which is pure-Python.

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY analytics_service/ ./analytics_service/

EXPOSE 8084

CMD ["python", "-m", "analytics_service.main"]
