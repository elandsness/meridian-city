-- Optional map coordinates for journeys with a moving-map visualisation (e.g. a
-- freight delivery's pickup/dropoff). NULL for journey types with no map (e.g. a
-- loan application journey) -- see Journey#originX for the coordinate space.
ALTER TABLE journey.journeys
    ADD COLUMN IF NOT EXISTS origin_x DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS origin_y DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS dest_x DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS dest_y DOUBLE PRECISION;
