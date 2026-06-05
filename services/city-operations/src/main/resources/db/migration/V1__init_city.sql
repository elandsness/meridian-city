CREATE SCHEMA IF NOT EXISTS city;

CREATE TABLE city.zones (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    zone_type VARCHAR(50),
    geojson TEXT
);

CREATE TABLE city.assets (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(50) NOT NULL,
    zone_id VARCHAR(50),
    status VARCHAR(30) DEFAULT 'operational',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE city.buildings (
    id VARCHAR(50) PRIMARY KEY REFERENCES city.assets(id),
    name VARCHAR(255),
    zone_id VARCHAR(50),
    floors INTEGER,
    year_built INTEGER,
    sensor_ids TEXT[],
    address VARCHAR(255)
);

CREATE TABLE city.vehicles (
    id VARCHAR(50) PRIMARY KEY REFERENCES city.assets(id),
    license_plate VARCHAR(20),
    vehicle_type VARCHAR(50),
    zone_id VARCHAR(50),
    driver_id VARCHAR(50)
);

CREATE SCHEMA IF NOT EXISTS incidents;

CREATE TABLE incidents.incidents (
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

CREATE TABLE incidents.work_orders (
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
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_assets_type ON city.assets(asset_type);
CREATE INDEX idx_assets_zone ON city.assets(zone_id);
CREATE INDEX idx_incidents_status ON incidents.incidents(status);
CREATE INDEX idx_work_orders_status ON incidents.work_orders(status);
CREATE INDEX idx_work_orders_request ON incidents.work_orders(request_id);
