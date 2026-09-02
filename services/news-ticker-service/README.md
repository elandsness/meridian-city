# News Ticker Service

Simple Node.js service that provides news ticker data for the Meridian City platform.

## API Endpoints

- `GET /api/v1/news` - List all news items
- `GET /api/v1/news/:id` - Get news item by ID
- `POST /api/v1/news` - Create new news item

## Configuration

- `PORT` - Service port (default: 8095)
- `KAFKA_BOOTSTRAP_SERVERS` - Kafka bootstrap servers (default: `meridian-kafka-bootstrap:9092`)

## Kafka Topics

- `news.events` - Published when new news items are created
