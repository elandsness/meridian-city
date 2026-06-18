-- Account-creation lifecycle events (registration_started -> details_submitted ->
-- verification_sent -> verified -> activated), written by citizen-service on
-- registration. The analytics-service builds the account-creation funnel by counting
-- distinct citizens per event_type. Kept separate from requests.request_events, whose
-- request_id has an FK to service_requests (account events aren't request-scoped).
CREATE TABLE IF NOT EXISTS citizens.account_events (
    id BIGSERIAL PRIMARY KEY,
    citizen_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_events_type
    ON citizens.account_events(event_type, created_at);
