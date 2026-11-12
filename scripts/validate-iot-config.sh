#!/bin/bash
# Usage: ./validate-iot-config.sh values-<industry>.yaml

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <values-file>"
  exit 1
fi

VALUES_FILE=$1
INDUSTRY_ID=$(grep "id:" "$VALUES_FILE" | head -n 1 | awk '{print $2}' | tr -d '"')

echo "Checking IoT config for industry: $INDUSTRY_ID"

# Extract the IoT configmap from the rendered template
# We look for the section starting with the IoT configmap name
RENDERED_IOT=$(helm template . -f "$VALUES_FILE" | sed -n '/# ConfigMap: iot-config/,/---/p')

if [ -z "$RENDERED_IOT" ]; then
  echo "✗ Error: Could not find iot-config ConfigMap in rendered template"
  exit 1
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
