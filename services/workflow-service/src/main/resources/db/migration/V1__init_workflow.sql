CREATE SCHEMA IF NOT EXISTS workflow;

-- Service requests (from citizen-service via API gateway)
CREATE TABLE IF NOT EXISTS workflow.service_requests (
    id VARCHAR(50) PRIMARY KEY,
    citizen_id VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    status VARCHAR(30) DEFAULT 'submitted',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    zone_id VARCHAR(50),
    assigned_department VARCHAR(100),
    assigned_to VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    lifecycle_stage VARCHAR(30),
    next_transition_at TIMESTAMPTZ
);

-- Work orders (from service-dispatch or IoT anomaly pipeline)
CREATE TABLE IF NOT EXISTS workflow.work_orders (
    id VARCHAR(50) PRIMARY KEY,
    incident_id VARCHAR(50),
    request_id VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    assigned_department VARCHAR(100),
    assigned_to VARCHAR(100),
    status VARCHAR(30) DEFAULT 'created',
    priority VARCHAR(20) DEFAULT 'normal',
    zone_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    next_transition_at TIMESTAMPTZ
);

-- Incidents (from IoT anomaly pipeline or manual creation)
CREATE TABLE IF NOT EXISTS workflow.incidents (
    id VARCHAR(50) PRIMARY KEY,
    asset_id VARCHAR(50),
    source VARCHAR(30) DEFAULT 'manual',
    severity VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(30) DEFAULT 'open',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- City assets (buildings, vehicles, infrastructure)
CREATE TABLE IF NOT EXISTS workflow.assets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    zone_id VARCHAR(50),
    status VARCHAR(30) DEFAULT 'operational',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON workflow.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_lifecycle ON workflow.service_requests(lifecycle_stage, next_transition_at);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON workflow.work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_request ON workflow.work_orders(request_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON workflow.incidents(status);
CREATE INDEX IF NOT EXISTS idx_assets_type ON workflow.assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_zone ON workflow.assets(zone_id);
