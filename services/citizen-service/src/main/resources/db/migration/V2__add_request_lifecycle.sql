-- Adds next_transition_at so the RequestLifecycleScheduler can advance service
-- requests through in_progress -> resolved on a timer (mirrors the commerce
-- FulfillmentScheduler). NULL means "no further transition scheduled": either a
-- terminal (resolved) request or one intentionally left incomplete for investigation.
ALTER TABLE requests.service_requests
    ADD COLUMN IF NOT EXISTS next_transition_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_service_requests_next_transition
    ON requests.service_requests(next_transition_at);
