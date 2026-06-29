-- Deferred dispatched/assigned emission for the Service Request business flow.
-- service-dispatch now persists a small lifecycle cursor on dispatch_log and the
-- DispatchLifecycleScheduler emits the two events at the absolute targets citizen-service
-- supplied, so they land realistically spaced instead of microseconds apart.
ALTER TABLE requests.dispatch_log
    ADD COLUMN IF NOT EXISTS citizen_id VARCHAR(50);
ALTER TABLE requests.dispatch_log
    ADD COLUMN IF NOT EXISTS status VARCHAR(30);
ALTER TABLE requests.dispatch_log
    ADD COLUMN IF NOT EXISTS dispatched_target_at TIMESTAMPTZ;
ALTER TABLE requests.dispatch_log
    ADD COLUMN IF NOT EXISTS assigned_target_at TIMESTAMPTZ;
ALTER TABLE requests.dispatch_log
    ADD COLUMN IF NOT EXISTS next_transition_at TIMESTAMPTZ;

-- The DispatchLifecycleScheduler polls on (status, next_transition_at).
CREATE INDEX IF NOT EXISTS idx_dispatch_log_status_transition
    ON requests.dispatch_log(status, next_transition_at);

-- Existing rows already emitted dispatched/assigned synchronously under the old flow.
UPDATE requests.dispatch_log
   SET status = 'done'
 WHERE status IS NULL;
