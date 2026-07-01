CREATE SCHEMA IF NOT EXISTS flights;

CREATE TABLE flights.flights (
    id                 VARCHAR(50) PRIMARY KEY,
    flight_number      VARCHAR(20) NOT NULL,
    airline            VARCHAR(100),
    direction          VARCHAR(20) NOT NULL DEFAULT 'departure',
    origin             VARCHAR(10),
    destination        VARCHAR(10),
    gate               VARCHAR(10),
    stand              VARCHAR(10),
    aircraft_type      VARCHAR(20),
    status             VARCHAR(30) NOT NULL DEFAULT 'at_gate',
    progress           DOUBLE PRECISION DEFAULT 0,
    scheduled_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW(),
    next_transition_at TIMESTAMPTZ
);

CREATE INDEX idx_flights_status ON flights.flights(status);
CREATE INDEX idx_flights_direction ON flights.flights(direction);
CREATE INDEX idx_flights_next_transition ON flights.flights(next_transition_at);
