#!/bin/bash
set -euo pipefail

NAME="${BRANDING_NAME:-Meridian City}"
COLOR="${BRANDING_COLOR:-#0B3D91}"
ACCENT="${BRANDING_ACCENT:-#EF9F27}"
ICON="${BRANDING_ICON:-}"
NAMESPACE="${BRANDING_NAMESPACE:-meridian}"
# Helm computes the exact ConfigMap name ops-dashboard's volume mount expects
# (`{meridian.fullname}-branding`, honoring fullnameOverride/truncation) and
# passes it straight through -- reconstructing that naming convention
# independently here would drift the moment the Helm helper changes.
CM_NAME="${BRANDING_CONFIGMAP_NAME:-meridian-branding}"

echo "Generating logo for ${NAME} (${COLOR})..."

# Square icon mark, not a wide text lockup: every real consumer of this file
# (BrandMark.jsx's small nav-header/login-page slot in both frontends, and
# theme.favicon) is a 1:1 box. A wide viewBox gets squished/distorted into a
# square box, and small text is illegible in a favicon anyway.
#
# bitnami/kubectl runs as a non-root UID with no write access to the
# container's default working directory ("/") -- confirmed live
# ("Permission denied" writing to the cwd). /tmp is writable by any UID.
LOGO_PATH="/tmp/logo.svg"
if [ -n "$ICON" ]; then
  # industry.theme.icon (a single emoji picked at authoring time to represent
  # the industry -- see AUTHORING_PROMPT.md) rendered on an accent-colored
  # circle. Deliberately NOT brand-colored and NOT ringed in brand: this mark
  # sits on a brand-colored banner in the UI, so anything using brand here
  # (fill or just a thin ring) blends straight into that background. accent
  # is guaranteed to be a different, industry-specific color (both are
  # schema-required), so a plain accent-filled circle is the one combination
  # that reliably contrasts against the banner it's actually placed on.
  cat > "$LOGO_PATH" <<EOF
<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="80" r="70" fill="${ACCENT}" />
  <text x="80" y="104" text-anchor="middle" font-size="76">${ICON}</text>
</svg>
EOF
else
  # No icon configured: the same generic chevron mark used before theme.icon
  # existed (company name isn't shown here, same as the built-in Meridian
  # fallback mark not showing text either).
  cat > "$LOGO_PATH" <<EOF
<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="80" r="70" fill="${COLOR}" />
  <path d="M50 110 L50 60 L80 90 L110 60 L110 110" stroke="white" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round" />
</svg>
EOF
fi

kubectl create configmap "$CM_NAME" --from-file=logo.svg="$LOGO_PATH" -n "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
echo "Successfully provisioned branding ConfigMap: $CM_NAME"
