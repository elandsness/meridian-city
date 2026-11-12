#!/bin/bash
# Usage: ./validate-iot-config.sh helm/values-<industry>.yaml
#
# Renders the real Helm output (not just the overlay file in isolation) and
# checks the industry didn't silently inherit City's iot.deviceTypes -- a
# values file that omits `iot:` entirely merges the base chart's list in
# wholesale, since Helm replaces lists rather than deep-merging them (see
# AUTHORING_PROMPT.md's "IoT Fleet Leak" gotcha).

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <values-file>"
  exit 1
fi

VALUES_FILE=$1
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$SCRIPT_DIR/../helm"

INDUSTRY_ID=$(grep -m1 "^\s*id:" "$VALUES_FILE" | awk '{print $2}' | tr -d '"')
echo "Checking IoT config for industry: ${INDUSTRY_ID:-unknown}"

RENDERED_IOT=$(helm template meridian "$CHART_DIR" -f "$VALUES_FILE" --show-only templates/iot-config-configmap.yaml 2>&1) || {
  echo "✗ Error: helm template failed:"
  echo "$RENDERED_IOT"
  exit 1
}

if [ -z "$RENDERED_IOT" ]; then
  echo "✗ Error: Could not find iot-config ConfigMap in rendered template"
  exit 1
fi

# An industry that opts out entirely (iot.enabled: false, per AUTHORING_PROMPT.md's
# "IoT Fleet Leak" rule) is compliant even if it never redefined deviceTypes --
# the leaked device-type names in the JSON are then moot (iot-simulator never runs).
if echo "$RENDERED_IOT" | grep -q '\\"enabled\\":false'; then
  echo "✓ IoT fleet simulation explicitly disabled (iot.enabled: false)."
  exit 0
fi

# Check if it contains "City Vehicle" or "Smart Building" (the City defaults)
if echo "$RENDERED_IOT" | grep -q "City Vehicle"; then
  echo "✗ Error: IoT config still contains City defaults (City Vehicle). Your industry must explicitly define its own iot.deviceTypes or set iot.enabled: false."
  exit 1
fi

if echo "$RENDERED_IOT" | grep -q "Smart Building"; then
  echo "✗ Error: IoT config still contains City defaults (Smart Building)."
  exit 1
fi

echo "✓ IoT config is industry-specific or disabled."
exit 0
