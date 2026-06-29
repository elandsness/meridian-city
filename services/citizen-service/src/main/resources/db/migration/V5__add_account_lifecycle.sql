-- Realistic Account Creation business-flow timing.
-- The signup burst (registration_started/details_submitted/verification_sent) stays
-- synchronous at registration; verified/activated are deferred by the AccountLifecycleScheduler.
-- account_lifecycle_stage is the cursor (verification_sent -> verified -> activated, or the
-- abandoned/verified_only drop-off terminals); account_next_transition_at is its poll time.
ALTER TABLE citizens.citizens
    ADD COLUMN IF NOT EXISTS account_lifecycle_stage VARCHAR(30);
ALTER TABLE citizens.citizens
    ADD COLUMN IF NOT EXISTS account_next_transition_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_citizens_account_lifecycle
    ON citizens.citizens(account_lifecycle_stage, account_next_transition_at);
