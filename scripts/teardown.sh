#!/usr/bin/env bash
# =============================================================================
# Meridian City Platform — Teardown Script
# =============================================================================
# Removes the Helm release and optionally the namespaces.
# Usage:
#   ./scripts/teardown.sh              Uninstall the Helm release
#   ./scripts/teardown.sh --all        Also delete the meridian and dynatrace namespaces
# =============================================================================
set -euo pipefail

RELEASE_NAME="${RELEASE_NAME:-meridian}"
NAMESPACE="${NAMESPACE:-meridian}"
DYNATRACE_NAMESPACE="dynatrace"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }

DELETE_NAMESPACES=false
[[ "${1:-}" == "--all" ]] && DELETE_NAMESPACES=true

if $DELETE_NAMESPACES; then
  warn "This will delete the Helm release AND the '$NAMESPACE' and '$DYNATRACE_NAMESPACE' namespaces."
  warn "All persistent data (PostgreSQL, Kafka) will be permanently deleted."
else
  warn "This will uninstall the '$RELEASE_NAME' Helm release from namespace '$NAMESPACE'."
fi

read -rp "Continue? [y/N] " confirm
[[ "${confirm:-N}" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

if helm status "$RELEASE_NAME" -n "$NAMESPACE" &>/dev/null; then
  info "Uninstalling Helm release: $RELEASE_NAME..."
  helm uninstall "$RELEASE_NAME" -n "$NAMESPACE" --timeout 5m
  success "Helm release removed."
else
  warn "Helm release '$RELEASE_NAME' not found in namespace '$NAMESPACE'. Skipping."
fi

if $DELETE_NAMESPACES; then
  for ns in "$NAMESPACE" "$DYNATRACE_NAMESPACE"; do
    if kubectl get namespace "$ns" &>/dev/null; then
      info "Deleting namespace: $ns..."
      kubectl delete namespace "$ns" --timeout=120s
      success "Namespace $ns deleted."
    fi
  done
fi

success "Teardown complete."
