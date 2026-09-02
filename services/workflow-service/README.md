# Workflow Service

Generic workflow service for managing service requests, work orders, incidents, and city assets.

## Overview

The workflow-service is a generic domain-pattern service that handles all workflow-related operations in the Meridian City platform. It replaces the domain-specific `service-dispatch` and `city-operations` services.

## Key Features

- **Service Requests**: Manage citizen service requests (e.g., pothole reports, noise complaints)
- **Work Orders**: Track work orders for maintenance, repairs, and other tasks
- **Incidents**: Handle incidents from IoT anomaly detection or manual creation
- **Assets**: Manage city assets (buildings, vehicles, infrastructure)

## API Endpoints

### Service Requests
- `POST /api/v1/service-requests` - Create a new service request
- `GET /api/v1/service-requests/{id}` - Get service request by ID
- `GET /api/v1/service-requests` - List service requests (optional `?status=` filter)

### Work Orders
- `POST /api/v1/work-orders` - Create a new work order
- `GET /api/v1/work-orders/{id}` - Get work order by ID
- `GET /api/v1/work-orders` - List work orders (optional `?status=` filter)
- `PATCH /api/v1/work-orders/{id}/status` - Update work order status

### Incidents
- `POST /api/v1/incidents` - Create a new incident
- `GET /api/v1/incidents/{id}` - Get incident by ID
- `GET /api/v1/incidents` - List active incidents
- `PATCH /api/v1/incidents/{id}` - Update incident status

### Assets
- `GET /api/v1/assets` - List assets (optional `?type=` filter)
- `GET /api/v1/assets/{id}` - Get asset by ID
- `GET /api/v1/assets/buildings` - List buildings

## Configuration

The workflow-service is configured via environment variables:

- `DB_HOST` - PostgreSQL host (default: `meridian-db-rw`)
- `DB_NAME` - Database name (default: `meridian`)
- `DB_USERNAME` - Database username (default: `meridian`)
- `DB_PASSWORD` - Database password
- `KAFKA_BOOTSTRAP_SERVERS` - Kafka bootstrap servers (default: `meridian-kafka-bootstrap:9092`)

## Database Schema

The service uses the `workflow` schema with the following tables:

- `service_requests` - Citizen service requests
- `work_orders` - Work orders for maintenance/repairs
- `incidents` - Incidents from IoT or manual creation
- `assets` - City assets (buildings, vehicles, infrastructure)

## Kafka Topics

- `workflow.events` - Workflow events (service requests, work orders, incidents)

## Deployment

The workflow-service is deployed as a Kubernetes Deployment with a ClusterIP Service on port 8083.

## Dependencies

- Java 21
- Spring Boot 3.3.5
- PostgreSQL
- Kafka
- Flyway (database migrations)
