# Journey Service

Generic journey service for managing configurable journey lifecycles.

## Overview

The journey-service is a generic domain-pattern service that handles all journey-related operations in the Meridian City platform. It replaces the domain-specific `flight-ops` and `passenger-service`.

## Key Features

- **Configurable Journeys**: Generic journey entity with configurable stages, transitions, and rules
- **Journey Lifecycle**: Timed advancement through stages with random delays
- **Journey Generation**: Automatic generation of new journeys to keep data feeling real
- **Fault Injection**: Demo-control-api integration for journey failures (cancellations, offloads)
- **Business Events**: Full instrumentation for journey lifecycle

## API Endpoints

### Journeys
- `GET /api/v1/journeys` - List journeys (optional `?entity_type=`, `?status=`, `?direction=` filters)
- `GET /api/v1/journeys/{id}` - Get journey by ID

### Admin (internal, not exposed via gateway)
- `POST /admin/fault` - Configure fault injection (failures_enabled, failure_stage, failure_rate)

## Configuration

The journey-service is configured via environment variables:

- `DB_HOST` - PostgreSQL host (default: `meridian-db-rw`)
- `DB_NAME` - Database name (default: `meridian`)
- `DB_USERNAME` - Database username (default: `meridian`)
- `DB_PASSWORD` - Database password
- `KAFKA_BOOTSTRAP_SERVERS` - Kafka bootstrap servers (default: `meridian-kafka-bootstrap:9092`)

### Journey Lifecycle Configuration

- `JOURNEY_LIFECYCLE_ENABLED` - Enable journey lifecycle (default: true)
- `JOURNEY_LIFECYCLE_MIN_SECONDS` - Min delay between transitions (default: 300)
- `JOURNEY_LIFECYCLE_MAX_SECONDS` - Max delay between transitions (default: 7200)

### Journey Generator Configuration

- `JOURNEY_GENERATOR_MAX_ACTIVE` - Max active journeys (default: 24)
- `PASSENGER_GENERATOR_MAX_ACTIVE` - Max active passenger journeys (default: 60)
- `PASSENGER_GENERATOR_BAG_PROBABILITY` - Probability of having a bag (default: 0.7)

### Fault Injection

- `FAULT_FAILURES_ENABLED` - Enable journey failures (default: false)
- `FAULT_FAILURES_RATE` - Failure rate 0.0-1.0 (default: 0.0)

## Database Schema

The service uses the `journey` schema with the following tables:

- `journeys` - Generic journey entities
- `journey_stages` - Stage transition audit trail
- `journey_configs` - Per-entity-type configuration

## Kafka Topics

- `journey.events` - Journey lifecycle events

## Deployment

The journey-service is deployed as a Kubernetes Deployment with a ClusterIP Service on port 8093.

## Dependencies

- Java 21
- Spring Boot 3.3.5
- PostgreSQL
- Kafka
- Flyway (database migrations)
