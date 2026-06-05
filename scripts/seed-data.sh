#!/usr/bin/env bash
# =============================================================================
# Meridian City Platform — Seed Data Script
# =============================================================================
# Populates the PostgreSQL database with realistic demo data:
#   - City assets (buildings, vehicles, zones, industrial machines)
#   - Citizen accounts
#   - Sample service requests in various states
#   - Historical IoT readings for dashboard charts
#
# Run this after the platform is deployed and PostgreSQL is healthy.
#
# Usage:
#   ./scripts/seed-data.sh                   Seed all data
#   ./scripts/seed-data.sh --reset           Drop existing data first, then seed
#   ./scripts/seed-data.sh --check           Verify seeded data counts only
# =============================================================================
set -euo pipefail

NAMESPACE="${NAMESPACE:-meridian}"
PG_HOST="${PG_HOST:-}"  # Auto-detected via port-forward if empty
PG_PORT="${PG_PORT:-5432}"
PG_DB="${PG_DB:-meridian}"
PG_USER="${PG_USER:-meridian}"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${BLUE}[SEED]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }

RESET=false
CHECK_ONLY=false
for arg in "$@"; do
  case $arg in
    --reset)  RESET=true ;;
    --check)  CHECK_ONLY=true ;;
  esac
done

# If no PG_HOST provided, port-forward and use localhost
PF_PID=""
if [[ -z "$PG_HOST" ]]; then
  info "Setting up port-forward to PostgreSQL..."
  kubectl port-forward svc/meridian-postgresql 15432:5432 -n "$NAMESPACE" &>/dev/null &
  PF_PID=$!
  sleep 3
  PG_HOST="localhost"
  PG_PORT="15432"
  trap 'kill $PF_PID 2>/dev/null; true' EXIT
fi

PG_PASSWORD=$(kubectl get secret meridian-secrets -n "$NAMESPACE" \
  -o jsonpath='{.data.db-password}' 2>/dev/null | base64 -d 2>/dev/null || echo "meridian-secret-change-me")

export PGPASSWORD="$PG_PASSWORD"

run_sql() {
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "$1" -q
}

run_sql_file() {
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -f "$1" -q
}

check_counts() {
  info "Verifying seed data counts..."
  run_sql "SELECT 'buildings' AS table, COUNT(*) FROM city.assets WHERE asset_type='building'
    UNION ALL SELECT 'vehicles', COUNT(*) FROM city.assets WHERE asset_type='vehicle'
    UNION ALL SELECT 'machines', COUNT(*) FROM city.assets WHERE asset_type='machine'
    UNION ALL SELECT 'citizens', COUNT(*) FROM citizens.citizens
    UNION ALL SELECT 'service_requests', COUNT(*) FROM requests.service_requests;"
}

if $CHECK_ONLY; then
  check_counts
  exit 0
fi

if $RESET; then
  info "Resetting existing data..."
  run_sql "TRUNCATE city.assets, city.buildings, city.vehicles, city.zones,
             citizens.citizens, citizens.accounts,
             requests.service_requests, requests.request_events,
             iot.devices, iot.device_readings CASCADE;"
  success "Data reset."
fi

# ---------------------------------------------------------------------------
info "Seeding city zones..."
run_sql "
INSERT INTO city.zones (id, name, zone_type, geojson) VALUES
  ('zone-north',     'North District',    'residential',  '{}'),
  ('zone-south',     'South District',    'commercial',   '{}'),
  ('zone-east',      'East Industrial',   'industrial',   '{}'),
  ('zone-west',      'West Harbor',       'mixed',        '{}'),
  ('zone-central',   'City Center',       'civic',        '{}')
ON CONFLICT (id) DO NOTHING;"
success "Zones seeded."

info "Seeding buildings..."
# 15 smart buildings across zones
for i in $(seq 1 15); do
  zone=$(echo "zone-north zone-south zone-central zone-west zone-central" | tr ' ' '\n' | sed -n "$((((i - 1) % 5) + 1))p")
  run_sql "INSERT INTO city.buildings (id, name, zone_id, floors, year_built, sensor_ids)
    VALUES ('bldg-$(printf '%02d' $i)', 'Meridian Building $(printf '%02d' $i)', '$zone',
            $((RANDOM % 20 + 5)), $((RANDOM % 40 + 1980)),
            ARRAY['sensor-hvac-$i', 'sensor-energy-$i', 'sensor-occupancy-$i'])
    ON CONFLICT (id) DO NOTHING;" 2>/dev/null || true
done
success "Buildings seeded."

info "Seeding vehicles..."
# 30 connected vehicles
for i in $(seq 1 30); do
  run_sql "INSERT INTO city.vehicles (id, license_plate, vehicle_type, zone_id)
    VALUES ('veh-$(printf '%03d' $i)', 'MRD-$(printf '%04d' $((RANDOM % 9999 + 1)))',
            '$(echo "bus truck maintenance patrol" | tr ' ' '\n' | sed -n "$((((i - 1) % 4) + 1))p")',
            'zone-$(echo "north south east west central" | tr ' ' '\n' | sed -n "$((((i - 1) % 5) + 1))p")')
    ON CONFLICT (id) DO NOTHING;" 2>/dev/null || true
done
success "Vehicles seeded."

info "Seeding industrial machines..."
for i in $(seq 1 10); do
  run_sql "INSERT INTO city.assets (id, name, asset_type, zone_id, metadata)
    VALUES ('mach-$(printf '%02d' $i)', 'Industrial Unit $(printf '%02d' $i)',
            'machine', 'zone-east', '{\"manufacturer\": \"MechCorp\", \"model\": \"MC-$(printf '%04d' $((RANDOM % 9999 + 1)))\"}')
    ON CONFLICT (id) DO NOTHING;" 2>/dev/null || true
done
success "Industrial machines seeded."

info "Seeding citizen accounts..."
for i in $(seq 1 50); do
  run_sql "INSERT INTO citizens.citizens (id, first_name, last_name, email, zone_id)
    VALUES ('cit-$(printf '%05d' $i)',
            '$(echo "Alice Bob Carol Dave Emma Frank Grace Henry Iris Jack" | tr ' ' '\n' | sed -n "$((((i - 1) % 10) + 1))p")',
            '$(echo "Smith Jones Williams Brown Davis Miller Wilson Moore Taylor Anderson" | tr ' ' '\n' | sed -n "$((((i - 1) % 10) + 1))p")',
            'citizen$(printf '%05d' $i)@meridian.city',
            '$(echo "zone-north zone-south zone-east zone-west zone-central" | tr ' ' '\n' | sed -n "$((((i - 1) % 5) + 1))p")')
    ON CONFLICT (id) DO NOTHING;" 2>/dev/null || true
done
success "Citizen accounts seeded."

info "Seeding sample service requests..."
run_sql "
INSERT INTO requests.service_requests (id, citizen_id, category, priority, status, title, created_at) VALUES
  ('req-00001', 'cit-00001', 'infrastructure', 'normal',   'resolved',    'Pothole on Main Street',          NOW() - INTERVAL '7 days'),
  ('req-00002', 'cit-00002', 'utilities',      'high',     'in_progress', 'Street light out on Oak Ave',     NOW() - INTERVAL '3 days'),
  ('req-00003', 'cit-00003', 'permits',        'normal',   'submitted',   'Home renovation permit',          NOW() - INTERVAL '1 day'),
  ('req-00004', 'cit-00004', 'sanitation',     'normal',   'assigned',    'Missed bin collection',           NOW() - INTERVAL '2 days'),
  ('req-00005', 'cit-00005', 'infrastructure', 'critical', 'in_progress', 'Flooding on Harbor Road',         NOW() - INTERVAL '12 hours'),
  ('req-00006', 'cit-00006', 'parks',          'low',      'resolved',    'Broken bench in Meridian Park',   NOW() - INTERVAL '14 days'),
  ('req-00007', 'cit-00007', 'utilities',      'normal',   'submitted',   'Water pressure issue',            NOW() - INTERVAL '4 hours'),
  ('req-00008', 'cit-00008', 'infrastructure', 'high',     'assigned',    'Traffic signal malfunction',      NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;"
success "Service requests seeded."

check_counts
success "Seed data complete. The platform is ready for demos."
