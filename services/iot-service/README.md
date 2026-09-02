# IoT Service

Consolidated IoT service for device simulation, telemetry ingestion, and anomaly detection.

## Overview

The iot-service consolidates three separate services (iot-simulator, iot-ingestion, telemetry-processor) into a single Go service that handles:

1. **Device Simulation**: Configurable fleet of IoT devices emitting telemetry
2. **Telemetry Ingestion**: Receives OTLP/gRPC telemetry from external simulators
3. **Anomaly Detection**: Processes telemetry, detects anomalies, stores in PostgreSQL

## Key Features

- **Configurable Device Types**: Buildings, vehicles, machines, sensors
- **Configurable Metrics**: Temperature, humidity, power, occupancy, vibration
- **Configurable Anomaly Thresholds**: Per-metric anomaly detection rules
- **Kafka Integration**: Publishes telemetry and anomalies to Kafka
- **OTLP Ingestion**: Receives OpenTelemetry Protocol data
- **PostgreSQL Storage**: Stores device metadata and telemetry history

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Simulators    │    │   iot-service    │    │   Kafka         │
│   (external)    │───▶│                  │───▶│   (anomalies)   │
└─────────────────┘    │  ┌────────────┐  │    └─────────────────┘
                       │  │ Simulator  │  │
                       │  │ (internal) │  │    ┌─────────────────┐
                       │  └────────────┘  │───▶│  Telemetry      │
                       │  ┌────────────┐  │    │  Processor      │
                       │  │ Ingestion  │  │    └─────────────────┘
                       │  └────────────┘  │
                       └──────────────────┘
```

## API Endpoints

### Devices
- `GET /api/v1/devices` - List devices (optional `?type=`, `?status=` filters)
- `GET /api/v1/devices/{id}` - Get device by ID
- `POST /api/v1/devices/{id}/anomaly` - Inject anomaly on device

### Telemetry
- `POST /api/v1/telemetry` - Ingest raw telemetry (OTLP/gRPC or REST)
- `GET /api/v1/telemetry/latest` - Get latest telemetry per device

### Anomalies
- `GET /api/v1/anomalies` - List anomalies (optional `?device_id=`, `?severity=` filters)
- `POST /api/v1/anomalies/{id}/acknowledge` - Acknowledge anomaly

### Fleet Management (internal)
- `POST /admin/fleet/scale` - Scale fleet (type, count)
- `POST /admin/fleet/anomaly` - Inject fleet anomaly (type, probability)

## Configuration

The iot-service is configured via environment variables:

- `DB_HOST` - PostgreSQL host (default: `meridian-db-rw`)
- `DB_NAME` - Database name (default: `meridian`)
- `DB_USERNAME` - Database username (default: `meridian`)
- `DB_PASSWORD` - Database password
- `KAFKA_BOOTSTRAP_SERVERS` - Kafka bootstrap servers (default: `meridian-kafka-bootstrap:9092`)
- `OTLP_GRPC_PORT` - gRPC port for OTLP ingestion (default: `4317`)
- `OTLP_HTTP_PORT` - HTTP port for OTLP ingestion (default: `4318`)

### Simulator Configuration

- `SIMULATOR_ENABLED` - Enable internal simulator (default: true)
- `SIMULATOR_FLEET_VEHICLES_COUNT` - Vehicle fleet size (default: 30)
- `SIMULATOR_FLEET_VEHICLES_EMIT_INTERVAL_SECONDS` - Vehicle telemetry interval (default: 15)
- `SIMULATOR_FLEET_BUILDINGS_COUNT` - Building fleet size (default: 15)
- `SIMULATOR_FLEET_BUILDINGS_EMIT_INTERVAL_SECONDS` - Building telemetry interval (default: 15)
- `SIMULATOR_FLEET_MACHINES_COUNT` - Machine fleet size (default: 10)
- `SIMULATOR_FLEET_MACHINES_EMIT_INTERVAL_SECONDS` - Machine telemetry interval (default: 15)

### Anomaly Detection Configuration

- `ANOMALY_DETECTION_ENABLED` - Enable anomaly detection (default: true)
- `ANOMALY_VEHICLE_TEMPERATURE_THRESHOLD` - Vehicle temperature threshold (default: 110)
- `ANOMALY_VEHICLE_VIBRATION_THRESHOLD` - Vehicle vibration threshold (default: 0.8)
- `ANOMALY_BUILDING_POWER_THRESHOLD` - Building power threshold (default: 5000)
- `ANOMALY_MACHINE_VIBRATION_THRESHOLD` - Machine vibration threshold (default: 1.2)

## Database Schema

The service uses the `iot` schema with the following tables:

- `devices` - Device metadata (type, fleet, status, last_seen)
- `telemetry` - Raw telemetry data (device_id, metric, value, timestamp)
- `anomalies` - Detected anomalies (device_id, metric, severity, status, acknowledged_at)

## Kafka Topics

- `iot.telemetry.raw` - Raw telemetry data (from simulator)
- `iot.anomalies` - Detected anomalies (to telemetry-processor, notification-service)

## Deployment

The iot-service is deployed as a Kubernetes Deployment with a ClusterIP Service on ports 4317 (gRPC) and 4318 (HTTP).

## Dependencies

- Go 1.22
- OpenTelemetry Go SDK
- PostgreSQL (pgx)
- Kafka (sarama)
- gRPC
