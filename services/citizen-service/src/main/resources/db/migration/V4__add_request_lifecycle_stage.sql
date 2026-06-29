-- Realistic Service Request business-flow timing.
-- lifecycle_stage is an internal cursor (submitted -> validated -> in_progress ->
-- resolved/abandoned) kept separate from the user-facing status so the portal UI is
-- unchanged. assigned_target_at is the absolute time the 'assigned' step is scheduled in
-- service-dispatch; citizen-service uses it to schedule in_progress strictly after assigned.
ALTER TABLE requests.service_requests
    ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(30);
ALTER TABLE requests.service_requests
    ADD COLUMN IF NOT EXISTS assigned_target_at TIMESTAMPTZ;

-- The RequestLifecycleScheduler polls on (lifecycle_stage, next_transition_at).
CREATE INDEX IF NOT EXISTS idx_service_requests_lifecycle_stage
    ON requests.service_requests(lifecycle_stage, next_transition_at);

-- Backfill in-flight rows from the previous (synchronous) flow so they keep advancing
-- without re-emitting steps. Under the old flow, submitted+validated+dispatched+assigned
-- were all emitted at submit, so a still-open 'submitted' row resumes at 'validated'
-- (next step = in_progress); an 'in_progress' row resumes in place. Rows with a NULL
-- next_transition_at (terminal/old backlog) are left untouched.
UPDATE requests.service_requests
   SET lifecycle_stage = CASE status
       WHEN 'submitted'   THEN 'validated'
       WHEN 'in_progress' THEN 'in_progress'
       ELSE status
   END
 WHERE next_transition_at IS NOT NULL
   AND lifecycle_stage IS NULL;
