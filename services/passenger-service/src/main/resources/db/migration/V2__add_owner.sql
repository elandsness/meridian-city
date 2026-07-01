ALTER TABLE passengers.passengers ADD COLUMN IF NOT EXISTS owner_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_passengers_owner ON passengers.passengers (owner_id);
