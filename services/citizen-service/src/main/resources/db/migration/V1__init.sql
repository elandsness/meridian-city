CREATE SCHEMA IF NOT EXISTS citizens;

CREATE TABLE citizens.citizens (
    id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    zone_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE citizens.accounts (
    id VARCHAR(50) PRIMARY KEY,
    citizen_id VARCHAR(50) NOT NULL REFERENCES citizens.citizens(id),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE SCHEMA IF NOT EXISTS requests;

CREATE TABLE requests.service_requests (
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
    resolved_at TIMESTAMPTZ
);

CREATE TABLE requests.request_events (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL REFERENCES requests.service_requests(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_service_requests_citizen ON requests.service_requests(citizen_id);
CREATE INDEX idx_service_requests_status ON requests.service_requests(status);
CREATE INDEX idx_request_events_request ON requests.request_events(request_id);
