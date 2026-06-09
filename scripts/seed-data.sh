#!/usr/bin/env bash
# =============================================================================
# Meridian City Platform — Seed Data Script
# =============================================================================
# Populates the PostgreSQL database with realistic demo data:
#   - City zones, buildings, vehicles, industrial machines
#   - Citizen accounts
#   - Sample service requests in various states
#
# Uses kubectl exec to run psql inside the CloudNativePG primary pod — no
# local psql installation required.
#
# Run this after the platform is deployed and PostgreSQL is healthy.
#
# Usage:
#   ./scripts/seed-data.sh                   Seed all data (idempotent)
#   ./scripts/seed-data.sh --reset           Truncate existing data first, then seed
#   ./scripts/seed-data.sh --check           Verify seeded data counts only
# =============================================================================
set -euo pipefail

NAMESPACE="${NAMESPACE:-meridian}"
PG_DB="${PG_DB:-meridian}"
PG_USER="${PG_USER:-meridian}"

# CloudNativePG names pods <cluster>-<ordinal>; the primary is always -1.
# Override DB_POD if your cluster uses a different name.
DB_POD="${DB_POD:-}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${BLUE}[SEED]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERR]${NC}   $*" >&2; }

RESET=false
CHECK_ONLY=false
for arg in "$@"; do
  case $arg in
    --reset)  RESET=true ;;
    --check)  CHECK_ONLY=true ;;
  esac
done

# ---------------------------------------------------------------------------
# Find the CloudNativePG primary pod
# ---------------------------------------------------------------------------
if [[ -z "$DB_POD" ]]; then
  DB_POD=$(kubectl get pods -n "$NAMESPACE" \
    -l "cnpg.io/cluster=meridian-db" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
fi

if [[ -z "$DB_POD" ]]; then
  error "Cannot find a running CloudNativePG pod in namespace '$NAMESPACE'."
  error "Is the platform deployed?  Try: kubectl get pods -n $NAMESPACE"
  exit 1
fi

info "Using database pod: $DB_POD"

# ---------------------------------------------------------------------------
# Helper: run SQL via kubectl exec (no local psql required)
# ---------------------------------------------------------------------------
run_sql() {
  kubectl exec -n "$NAMESPACE" "$DB_POD" -- \
    psql -U "$PG_USER" -d "$PG_DB" -c "$1" -q
}

check_counts() {
  info "Verifying seed data counts..."
  kubectl exec -n "$NAMESPACE" "$DB_POD" -- psql -U "$PG_USER" -d "$PG_DB" -q <<'EOF'
SELECT 'zones'            AS "table", COUNT(*)::int AS rows FROM city.zones
UNION ALL
SELECT 'buildings',        COUNT(*)::int FROM city.assets WHERE asset_type = 'building'
UNION ALL
SELECT 'vehicles',         COUNT(*)::int FROM city.assets WHERE asset_type = 'vehicle'
UNION ALL
SELECT 'machines',         COUNT(*)::int FROM city.assets WHERE asset_type = 'machine'
UNION ALL
SELECT 'citizens',         COUNT(*)::int FROM citizens.citizens
UNION ALL
SELECT 'service_requests', COUNT(*)::int FROM requests.service_requests;
EOF
}

if $CHECK_ONLY; then
  check_counts
  exit 0
fi

if $RESET; then
  info "Resetting existing data..."
  kubectl exec -n "$NAMESPACE" "$DB_POD" -- psql -U "$PG_USER" -d "$PG_DB" -q <<'EOF'
TRUNCATE
  city.assets,
  city.buildings,
  city.vehicles,
  city.zones,
  citizens.accounts,
  citizens.citizens,
  requests.request_events,
  requests.service_requests,
  incidents.work_orders,
  incidents.incidents
CASCADE;
EOF
  success "Data reset."
fi

# ---------------------------------------------------------------------------
# Schema bridge: ensure tables that may be missing from the current image exist.
#
# V2 Flyway migrations for city-operations and service-dispatch were added to
# the fix/strimzi-api-v1 branch but haven't merged to main yet, so the GHCR
# images were built without them.  We create the tables here (idempotent) so
# the running services have them available.  Once the branch merges and CI
# publishes new images, the V2 migrations will run on startup and these
# CREATE TABLE IF NOT EXISTS statements become harmless no-ops.
# ---------------------------------------------------------------------------
info "Ensuring schema tables exist (bridge for images where baseline-version=0 fix is not yet deployed)..."
# These are non-fatal: if Flyway already created the tables (once the
# baseline-version: 0 fix is live in the image) the IF NOT EXISTS is a no-op.
run_sql "CREATE TABLE IF NOT EXISTS requests.dispatch_log (
    id                  BIGSERIAL        PRIMARY KEY,
    request_id          VARCHAR(50)      NOT NULL,
    category            VARCHAR(50),
    zone_id             VARCHAR(50),
    assigned_department VARCHAR(100),
    routing_reason      TEXT,
    dispatched_at       TIMESTAMPTZ      DEFAULT NOW()
);" || warn "dispatch_log bridge skipped (may already exist or schema not ready yet)"
success "Schema bridge step complete."

# ---------------------------------------------------------------------------
info "Seeding city zones..."
run_sql "
INSERT INTO city.zones (id, name, zone_type, geojson) VALUES
  ('zone-north',   'North District',  'residential', '{}'),
  ('zone-south',   'South District',  'commercial',  '{}'),
  ('zone-east',    'East Industrial', 'industrial',  '{}'),
  ('zone-west',    'West Harbor',     'mixed',       '{}'),
  ('zone-central', 'City Center',     'civic',       '{}')
ON CONFLICT (id) DO NOTHING;"
success "Zones seeded."

# ---------------------------------------------------------------------------
info "Seeding buildings..."
kubectl exec -n "$NAMESPACE" "$DB_POD" -- psql -U "$PG_USER" -d "$PG_DB" -q <<'EOF'
INSERT INTO city.assets (id, name, asset_type, zone_id, status)
SELECT
  'bldg-' || lpad(n::text, 2, '0'),
  'Meridian Building ' || lpad(n::text, 2, '0'),
  'building',
  (ARRAY['zone-north','zone-south','zone-central','zone-west','zone-central'])[(n - 1) % 5 + 1],
  'operational'
FROM generate_series(1, 15) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO city.buildings (id, name, zone_id, floors, year_built, sensor_ids)
SELECT
  'bldg-' || lpad(n::text, 2, '0'),
  'Meridian Building ' || lpad(n::text, 2, '0'),
  (ARRAY['zone-north','zone-south','zone-central','zone-west','zone-central'])[(n - 1) % 5 + 1],
  5 + (n % 20),
  1980 + (n % 40),
  ARRAY['sensor-hvac-' || n, 'sensor-energy-' || n, 'sensor-occupancy-' || n]
FROM generate_series(1, 15) AS n
ON CONFLICT (id) DO NOTHING;
EOF
success "Buildings seeded."

# ---------------------------------------------------------------------------
info "Seeding vehicles..."
kubectl exec -n "$NAMESPACE" "$DB_POD" -- psql -U "$PG_USER" -d "$PG_DB" -q <<'EOF'
INSERT INTO city.assets (id, name, asset_type, zone_id, status)
SELECT
  'veh-' || lpad(n::text, 3, '0'),
  'Vehicle ' || lpad(n::text, 3, '0'),
  'vehicle',
  (ARRAY['zone-north','zone-south','zone-east','zone-west','zone-central'])[(n - 1) % 5 + 1],
  'operational'
FROM generate_series(1, 30) AS n
ON CONFLICT (id) DO NOTHING;

INSERT INTO city.vehicles (id, license_plate, vehicle_type, zone_id)
SELECT
  'veh-' || lpad(n::text, 3, '0'),
  'MRD-' || lpad((1000 + n)::text, 4, '0'),
  (ARRAY['bus','truck','maintenance','patrol'])[(n - 1) % 4 + 1],
  (ARRAY['zone-north','zone-south','zone-east','zone-west','zone-central'])[(n - 1) % 5 + 1]
FROM generate_series(1, 30) AS n
ON CONFLICT (id) DO NOTHING;
EOF
success "Vehicles seeded."

# ---------------------------------------------------------------------------
info "Seeding industrial machines..."
kubectl exec -n "$NAMESPACE" "$DB_POD" -- psql -U "$PG_USER" -d "$PG_DB" -q <<'EOF'
INSERT INTO city.assets (id, name, asset_type, zone_id, status, metadata)
SELECT
  'mach-' || lpad(n::text, 2, '0'),
  'Industrial Unit ' || lpad(n::text, 2, '0'),
  'machine',
  'zone-east',
  'operational',
  ('{"manufacturer":"MechCorp","model":"MC-' || lpad((1000 + n)::text, 4, '0') || '"}')::jsonb
FROM generate_series(1, 10) AS n
ON CONFLICT (id) DO NOTHING;
EOF
success "Industrial machines seeded."

# ---------------------------------------------------------------------------
info "Seeding citizen accounts..."
kubectl exec -n "$NAMESPACE" "$DB_POD" -- psql -U "$PG_USER" -d "$PG_DB" -q <<'EOF'
INSERT INTO citizens.citizens (id, first_name, last_name, email, zone_id)
SELECT
  'cit-' || lpad(n::text, 5, '0'),
  (ARRAY['Alice','Bob','Carol','Dave','Emma','Frank','Grace','Henry','Iris','Jack'])[(n - 1) % 10 + 1],
  (ARRAY['Smith','Jones','Williams','Brown','Davis','Miller','Wilson','Moore','Taylor','Anderson'])[(n - 1) % 10 + 1],
  'citizen' || lpad(n::text, 5, '0') || '@meridian.city',
  (ARRAY['zone-north','zone-south','zone-east','zone-west','zone-central'])[(n - 1) % 5 + 1]
FROM generate_series(1, 50) AS n
ON CONFLICT (id) DO NOTHING;
EOF
success "Citizen accounts seeded."

# ---------------------------------------------------------------------------
info "Seeding sample service requests..."
run_sql "
INSERT INTO requests.service_requests
  (id, citizen_id, category, priority, status, title, created_at)
VALUES
  ('req-00001','cit-00001','infrastructure','normal',  'resolved',    'Pothole on Main Street',        NOW() - INTERVAL '7 days'),
  ('req-00002','cit-00002','utilities',     'high',    'in_progress', 'Street light out on Oak Ave',   NOW() - INTERVAL '3 days'),
  ('req-00003','cit-00003','permits',       'normal',  'submitted',   'Home renovation permit',        NOW() - INTERVAL '1 day'),
  ('req-00004','cit-00004','sanitation',    'normal',  'assigned',    'Missed bin collection',         NOW() - INTERVAL '2 days'),
  ('req-00005','cit-00005','infrastructure','critical','in_progress', 'Flooding on Harbor Road',       NOW() - INTERVAL '12 hours'),
  ('req-00006','cit-00006','parks',         'low',     'resolved',    'Broken bench in Meridian Park', NOW() - INTERVAL '14 days'),
  ('req-00007','cit-00007','utilities',     'normal',  'submitted',   'Water pressure issue',          NOW() - INTERVAL '4 hours'),
  ('req-00008','cit-00008','infrastructure','high',    'assigned',    'Traffic signal malfunction',    NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;"
success "Service requests seeded."

# ---------------------------------------------------------------------------
check_counts
success "Seed data complete. The platform is ready for demos."
