CREATE SCHEMA IF NOT EXISTS passengers;

CREATE TABLE IF NOT EXISTS passengers.passengers (
    id                 VARCHAR(64) PRIMARY KEY,
    name               VARCHAR(128) NOT NULL,
    booking_ref        VARCHAR(32)  NOT NULL,
    seat               VARCHAR(8),
    flight_id          VARCHAR(64),
    flight_number      VARCHAR(16),
    gate               VARCHAR(8),
    has_bag            BOOLEAN          NOT NULL DEFAULT FALSE,
    status             VARCHAR(32)      NOT NULL DEFAULT 'checked_in',
    progress           DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),
    next_transition_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_passengers_status ON passengers.passengers (status);
CREATE INDEX IF NOT EXISTS idx_passengers_next_transition ON passengers.passengers (next_transition_at);
CREATE INDEX IF NOT EXISTS idx_passengers_flight ON passengers.passengers (flight_id);
