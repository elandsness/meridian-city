-- V1 created city.assets.metadata as JSONB, but CityAsset.java declares
-- @Column(columnDefinition = "TEXT").  With ddl-auto=validate, Hibernate
-- rejects a JSONB column when the entity expects TEXT (VARCHAR), causing a
-- CrashLoopBackOff on every fresh deployment.
--
-- The application treats metadata as an opaque JSON string (no PG JSON
-- operators are used), so TEXT is the correct storage type.  This migration
-- converts the column type so the schema and entity agree.
--
-- Safe to re-run: casting TEXT → TEXT is a no-op in PostgreSQL, so this
-- migration is idempotent against databases that were patched manually.

ALTER TABLE city.assets
    ALTER COLUMN metadata TYPE TEXT USING metadata::TEXT;
