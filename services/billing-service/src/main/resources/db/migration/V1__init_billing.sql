CREATE SCHEMA IF NOT EXISTS billing;

CREATE TABLE billing.tax_bills (
    id VARCHAR(50) PRIMARY KEY,
    citizen_id VARCHAR(50) NOT NULL,
    period VARCHAR(20) NOT NULL,
    amount_cents INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'outstanding',
    issued_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tax_bills_citizen ON billing.tax_bills(citizen_id);
CREATE INDEX idx_tax_bills_status ON billing.tax_bills(status);
