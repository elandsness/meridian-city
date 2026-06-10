#!/usr/bin/env bash
# =============================================================================
# Meridian City Platform — Teardown Script
# =============================================================================
# Usage:
#   ./scripts/teardown.sh              Full teardown — kills port-forwards,
#                                      uninstalls Helm release, deletes PVCs
#                                      and namespaces.  This is the default
#                                      because a stale PostgreSQL PVC causes
#                                      Flyway / schema problems on the next
#                                      fresh install.
#
#   ./scripts/teardown.sh --soft       Helm uninstall only.  Port-forwards are
#                                      still stopped, but namespaces and PVCs
#                                      are preserved (useful for iterating on
#                                      Helm chart changes without losing data).
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

SOFT=false
[[ "${1:-}" == "--soft" ]] && SOFT=true

if $SOFT; then
  warn "Soft teardown: port-forwards will be stopped and the Helm release will"
  warn "be uninstalled, but namespaces and PVCs are preserved."
else
  warn "Full teardown: port-forwards, Helm release, ALL persistent data"
  warn "(PostgreSQL PVCs, Kafka PVCs), and namespaces will be permanently deleted."
fi

read -rp "Continue? [y/N] " confirm
[[ "${confirm:-N}" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

# ---------------------------------------------------------------------------
# 1. Kill port-forwards
# ---------------------------------------------------------------------------
info "Stopping port-forwards..."
_pf_stopped=false
# Kill the restart loops first (so they don't respawn kubectl after pkill).
_PF_PIDS_FILE="/tmp/meridian-pf-pids"
if [[ -f "$_PF_PIDS_FILE" ]]; then
  while IFS= read -r pid; do
    kill   "$pid"   2>/dev/null || true
    pkill -P "$pid" 2>/dev/null || true  # also kill the kubectl child
  done < "$_PF_PIDS_FILE"
  rm -f "$_PF_PIDS_FILE"
  _pf_stopped=true
fi
# Fallback: catch any kubectl port-forward processes not tracked via PID file
# (e.g. from a manual ./scripts/deploy.sh port-forward run).
if pkill -f "kubectl port-forward" 2>/dev/null; then
  _pf_stopped=true
fi
$_pf_stopped && success "Port-forwards stopped." || info "No port-forwards were running."

# ---------------------------------------------------------------------------
# 2. Helm uninstall
# ---------------------------------------------------------------------------
if helm status "$RELEASE_NAME" -n "$NAMESPACE" &>/dev/null; then
  info "Uninstalling Helm release: $RELEASE_NAME..."
  helm uninstall "$RELEASE_NAME" -n "$NAMESPACE" --timeout 5m
  success "Helm release removed."
else
  warn "Helm release '$RELEASE_NAME' not found in namespace '$NAMESPACE'. Skipping."
fi

if $SOFT; then
  success "Soft teardown complete."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2b. Uninstall the Dynatrace Operator — it is its own Helm release in the
#     dynatrace namespace (see scripts/deploy.sh), not part of the meridian
#     release. Uninstall it before deleting the namespace so it can clean up
#     its webhook configuration and finalizers, and so its cluster-scoped CRDs
#     are removed rather than orphaned.
# ---------------------------------------------------------------------------
if helm status dynatrace-operator -n "$DYNATRACE_NAMESPACE" &>/dev/null; then
  info "Uninstalling Dynatrace Operator..."
  helm uninstall dynatrace-operator -n "$DYNATRACE_NAMESPACE" --timeout 5m 2>/dev/null || true
  success "Dynatrace Operator removed."
fi

# ---------------------------------------------------------------------------
# 3. Delete PVCs explicitly before namespace deletion.
#    CNPG and Strimzi operators create PVCs outside of Helm's ownership, so
#    helm uninstall does not remove them.  Leaving them behind causes Flyway
#    schema-history conflicts and Kafka offset conflicts on the next fresh
#    install.  Namespace deletion normally cascades to PVCs, but we delete
#    them explicitly first so the namespace is not held in Terminating state
#    by PVC finalizers.
# ---------------------------------------------------------------------------
for ns in "$NAMESPACE" "$DYNATRACE_NAMESPACE"; do
  if kubectl get namespace "$ns" &>/dev/null 2>&1; then
    pvc_count=$(kubectl get pvc -n "$ns" --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$pvc_count" -gt 0 ]]; then
      info "Deleting $pvc_count PVC(s) in namespace $ns..."
      kubectl delete pvc --all -n "$ns" --timeout=60s 2>/dev/null || true
    fi
  fi
done

# ---------------------------------------------------------------------------
# 4. Delete namespaces
#    Submit with --wait=false so we don't block on CNPG/Strimzi CRD
#    finalizers.  We then poll for up to 60 s; if the namespace is still
#    terminating after that, we exit cleanly — 'deploy.sh install' already
#    handles Terminating namespaces by waiting for them to clear.
# ---------------------------------------------------------------------------
for ns in "$NAMESPACE" "$DYNATRACE_NAMESPACE"; do
  if kubectl get namespace "$ns" &>/dev/null 2>&1; then
    info "Deleting namespace: $ns..."
    kubectl delete namespace "$ns" --wait=false 2>/dev/null || true
    # Poll briefly so a fast delete prints a clean success message.
    if kubectl wait --for=delete namespace/"$ns" --timeout=60s 2>/dev/null; then
      success "Namespace $ns deleted."
    else
      warn "Namespace $ns is still terminating (common with CNPG/Strimzi finalizers)."
      warn "It will finish in the background.  If you re-deploy immediately,"
      warn "'deploy.sh install' will wait for it to clear automatically."
    fi
  fi
done

success "Teardown complete."
