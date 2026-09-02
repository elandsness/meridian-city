CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.identities (
    id VARCHAR(50) PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    zone_id VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    account_lifecycle_stage VARCHAR(30),
    account_next_transition_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS identity.accounts (
    id VARCHAR(50) PRIMARY KEY,
    identity_id VARCHAR(50) NOT NULL REFERENCES identity.identities(id),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS identity.identity_events (
    id BIGSERIAL PRIMARY KEY,
    identity_id VARCHAR(50) NOT NULL REFERENCES identity.identities(id),
    event_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identities_email ON identity.identities(email);
CREATE INDEX IF NOT EXISTS idx_identities_lifecycle ON identity.identities(account_lifecycle_stage, account_next_transition_at);
CREATE INDEX IF NOT EXISTS idx_accounts_identity_id ON identity.accounts(identity_id);
CREATE INDEX IF NOT EXISTS idx_identity_events_identity_id ON identity.identity_events(identity_id);
