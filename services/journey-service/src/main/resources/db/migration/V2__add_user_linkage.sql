
-- Add user-linkage fields to journey_configs
ALTER TABLE journey.journey_configs ADD COLUMN IF NOT EXISTS is_user_linked BOOLEAN DEFAULT FALSE;
ALTER TABLE journey.journey_configs ADD COLUMN IF NOT EXISTS owner_field VARCHAR(50);

-- Mark passenger as user-linked
UPDATE journey.journey_configs SET is_user_linked = TRUE, owner_field = 'user_id' WHERE entity_type = 'passenger';
