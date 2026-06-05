CREATE TABLE IF NOT EXISTS requests.dispatch_log (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    zone_id VARCHAR(50),
    assigned_department VARCHAR(100),
    routing_reason TEXT,
    dispatched_at TIMESTAMPTZ DEFAULT NOW()
);
