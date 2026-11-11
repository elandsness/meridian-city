#!/bin/bash
set -euo pipefail

NAME="${BRANDING_NAME:-Meridian City}"
COLOR="${BRANDING_COLOR:-#0B3D91}"
NAMESPACE="${BRANDING_NAMESPACE:-meridian}"
# Helm computes the exact ConfigMap name ops-dashboard's volume mount expects
# (`{meridian.fullname}-branding`, honoring fullnameOverride/truncation) and
# passes it straight through -- reconstructing that naming convention
# independently here would drift the moment the Helm helper changes.
CM_NAME="${BRANDING_CONFIGMAP_NAME:-meridian-branding}"

display_name="$NAME"
if [ "${#NAME}" -ge 30 ]; then
  display_name="${NAME:0:27}..."
fi

echo "Generating logo for ${NAME} (${COLOR})..."

cat > logo.svg <<EOF
<svg width="400" height="80" viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>.text { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-weight: 600; }</style>
  </defs>
  <circle cx="40" cy="40" r="35" fill="${COLOR}" />
  <path d="M25 55 L25 30 L40 45 L55 30 L55 55" stroke="white" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
  <text x="85" y="48" fill="#333" font-size="28" class="text">${display_name}</text>
  <text x="85" y="68" fill="#666" font-size="14" class="text" font-weight="400">Observability Platform</text>
</svg>
EOF

kubectl create configmap "$CM_NAME" --from-file=logo.svg=logo.svg -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo "Successfully provisioned branding ConfigMap: $CM_NAME"
