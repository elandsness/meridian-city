-- Timestamps + scheduling column so the WorkOrderLifecycleScheduler can advance
-- work orders through created -> assigned -> acknowledged -> resolved on a timer,
-- which fills in the iot-incident Business Analytics funnel. next_transition_at NULL
-- means terminal (resolved) or intentionally-incomplete (left for investigation).
ALTER TABLE incidents.work_orders
    ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE incidents.work_orders
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE incidents.work_orders
    ADD COLUMN IF NOT EXISTS next_transition_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_work_orders_next_transition
    ON incidents.work_orders(next_transition_at);
