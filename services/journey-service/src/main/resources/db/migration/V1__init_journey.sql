CREATE SCHEMA IF NOT EXISTS journey;

-- Journeys (generic: flights, passengers, patients, loans, etc.)
CREATE TABLE IF NOT EXISTS journey.journeys (
    id VARCHAR(50) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    related_id VARCHAR(50),
    direction VARCHAR(50),
    origin VARCHAR(100),
    destination VARCHAR(100),
    metadata JSONB,
    status VARCHAR(50) NOT NULL DEFAULT 'initiated',
    progress DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    scheduled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    next_transition_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_journeys_entity ON journey.journeys(entity_type);
CREATE INDEX IF NOT EXISTS idx_journeys_status ON journey.journeys(status);
CREATE INDEX IF NOT EXISTS idx_journeys_lifecycle ON journey.journeys(next_transition_at) WHERE next_transition_at IS NOT NULL;

-- Journey stages (audit trail of stage transitions)
CREATE TABLE IF NOT EXISTS journey.journey_stages (
    id VARCHAR(50) PRIMARY KEY,
    journey_id VARCHAR(50) NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    progress DOUBLE PRECISION NOT NULL,
    entered_at TIMESTAMPTZ,
    exited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_journey_stages_journey ON journey.journey_stages(journey_id);

-- Journey configs (per-entity-type configuration)
CREATE TABLE IF NOT EXISTS journey.journey_configs (
    id VARCHAR(50) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    stages JSONB,
    transitions JSONB,
    fault_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
