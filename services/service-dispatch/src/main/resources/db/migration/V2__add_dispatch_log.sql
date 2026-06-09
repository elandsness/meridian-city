-- The current V1 migration creates requests.dispatch_log, but Docker images
-- built before that change was committed do not contain the table.  When
-- Hibernate ddl-auto=validate runs against a schema without this table it
-- throws "missing table [requests.dispatch_log]" and the pod crash-loops.
--
-- This V2 migration is an idempotent safety net: it creates the table only
-- if it does not already exist, so it is safe for both:
--   • Fresh deployments using rebuilt images (V1 created the table → no-op)
--   • Deployments using older images (V1 skipped the table → table created here)

CREATE TABLE IF NOT EXISTS requests.dispatch_log (
    id                  BIGSERIAL        PRIMARY KEY,
    request_id          VARCHAR(50)      NOT NULL,
    category            VARCHAR(50),
    zone_id             VARCHAR(50),
    assigned_department VARCHAR(100),
    routing_reason      TEXT,
    dispatched_at       TIMESTAMPTZ      DEFAULT NOW()
);
