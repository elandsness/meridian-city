FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY analytics_service/ ./analytics_service/

EXPOSE 8084

CMD ["python", "-m", "analytics_service.main"]
