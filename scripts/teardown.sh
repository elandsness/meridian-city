#!/usr/bin/env bash
# =============================================================================
# Meridian City Platform — Teardown Script (per-instance, multi-tenancy safe)
# =============================================================================
# Tears down ONE Meridian instance without disturbing other concurrent instances
# or the SHARED cluster-singleton operators (CloudNativePG, Strimzi, Dynatrace).
#
# Instance selection: set RELEASE_NAME=meridian-<hash> (or pass it as the first
# positional arg). If omitted, the sole meridian-* release is auto-detected; with
# more than one present you must name which to remove.
#
# Usage:
#   ./scripts/teardown.sh [meridian-<hash>]   Full teardown of ONE instance — stops
#                                             its port-forwards, deletes its operator
#                                             CRs, `helm uninstall` (which deprovisions
#                                             its Dynatrace pipeline/flows/routing via
#                                             the pre-delete hook), deletes its DynaKube,
#                                             PVCs, and namespace. Shared operators stay.
#
#   ./scripts/teardown.sh --soft              Helm uninstall only (still deprovisions the
#                                             tenant objects); namespace + PVCs preserved.
#
#   ./scripts/teardown.sh --pf                Stop this instance's port-forwards only
#                                             (no cluster changes).
#
#   ./scripts/teardown.sh --with-shared-operators
#                                             After removing the instance, ALSO remove the
#                                             SHARED operators (CNPG/Strimzi/Dynatrace), their
#                                             namespaces, and the CNPG CRDs. DESTRUCTIVE TO
#                                             ALL INSTANCES — only run when none remain.
# =============================================================================
set -euo pipefail

DYNATRACE_NAMESPACE="dynatrace"
CNPG_NAMESPACE="${CNPG_NAMESPACE:-cnpg-system}"
CNPG_RELEASE="${CNPG_RELEASE:-cnpg}"
STRIMZI_NAMESPACE="${STRIMZI_NAMESPACE:-strimzi-system}"
STRIMZI_RELEASE="${STRIMZI_RELEASE:-strimzi}"

RELEASE_NAME="${RELEASE_NAME:-}"
NAMESPACE="${NAMESPACE:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Resolve which instance to tear down: explicit RELEASE_NAME / positional arg, else
# auto-detect the sole meridian-* release (error on 0 or >1).
resolve_instance() {
  if [[ -z "$RELEASE_NAME" ]]; then
    local found n
    found=$(helm list -A -q --filter '^meridian-' 2>/dev/null || true)
    n=$(printf '%s' "$found" | grep -c . || true)
    if [[ "$n" -eq 1 ]]; then
      RELEASE_NAME="$found"
    elif [[ "$n" -eq 0 ]]; then
      error "No Meridian instance found. Pass the release name: $0 meridian-<hash>"
      exit 1
    else
      error "Multiple Meridian instances found — name the one to remove:"
      printf '%s\n' "$found" | sed 's/^/    /' >&2
      error "e.g. RELEASE_NAME=meridian-a1b2 $0   (or: $0 meridian-a1b2)"
      exit 1
    fi
  fi
  NAMESPACE="${NAMESPACE:-$RELEASE_NAME}"
  info "Target instance: release=${RELEASE_NAME}  namespace=${NAMESPACE}"
}

_PF_PIDS_FILE="/tmp/meridian-pf-pids"

# Stop the port-forwards for THIS instance's namespace. Anchored on
# "port-forward ... -n <ns>" so it never touches another instance's forwards.
stop_port_forwards() {
  local stopped=false pid ppid pcmd p
  local -a loop_pids=()
  local pattern="port-forward .*-n ${NAMESPACE}"

  if [[ -f "$_PF_PIDS_FILE" ]]; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && loop_pids+=("$pid")
    done < "$_PF_PIDS_FILE"
  fi

  # Orphaned restart-loops: the deploy.sh parent of each live kubectl port-forward
  # for this namespace (adopting only deploy.sh parents, never init/unrelated shells).
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [[ -z "$ppid" || "$ppid" == "1" ]] && continue
    pcmd=$(ps -o command= -p "$ppid" 2>/dev/null || true)
    [[ "$pcmd" == *deploy.sh* ]] && loop_pids+=("$ppid")
  done < <(pgrep -f "$pattern" 2>/dev/null || true)

  if [[ ${#loop_pids[@]} -gt 0 ]]; then
    for p in "${loop_pids[@]}"; do
      if kill "$p" 2>/dev/null; then stopped=true; fi
      pkill -P "$p" 2>/dev/null || true
    done
  fi
  if pkill -f "$pattern" 2>/dev/null; then stopped=true; fi

  # The PID file is last-deploy-run only; remove it (best effort) so it doesn't go stale.
  rm -f "$_PF_PIDS_FILE" 2>/dev/null || true
  $stopped && success "Port-forwards stopped." || info "No port-forwards were running for $NAMESPACE."
}

SOFT=false
PF_ONLY=false
WITH_SHARED=false
for arg in "$@"; do
  case "$arg" in
    --soft) SOFT=true ;;
    --pf)   PF_ONLY=true ;;
    --with-shared-operators) WITH_SHARED=true ;;
    -*)     warn "Unknown flag: $arg" ;;
    *)      RELEASE_NAME="$arg" ;;  # positional: the release to remove
  esac
done

resolve_instance

# Port-forward-only mode changes no cluster state — run immediately, no prompt.
if $PF_ONLY; then
  info "Stopping port-forwards for $NAMESPACE (no cluster changes)..."
  stop_port_forwards
  exit 0
fi

if $SOFT; then
  warn "Soft teardown of '$RELEASE_NAME': port-forwards stopped and the Helm release"
  warn "uninstalled (its Dynatrace objects are deprovisioned), but namespace + PVCs kept."
else
  warn "Full teardown of instance '$RELEASE_NAME': port-forwards, Helm release, its"
  warn "Dynatrace pipeline/flows/routing, DynaKube, ALL its persistent data (PVCs), and"
  warn "its namespace '$NAMESPACE' will be permanently deleted."
fi
if $WITH_SHARED; then
  warn ""
  warn "PLUS --with-shared-operators: the SHARED CloudNativePG, Strimzi, and Dynatrace"
  warn "operators, their namespaces, and the CNPG CRDs will ALSO be removed. This BREAKS"
  warn "every OTHER Meridian instance on this cluster — only proceed if none remain."
fi

read -rp "Continue? [y/N] " confirm
[[ "${confirm:-N}" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }

# ---------------------------------------------------------------------------
# 1. Stop this instance's port-forwards.
# ---------------------------------------------------------------------------
info "Stopping port-forwards..."
stop_port_forwards

# ---------------------------------------------------------------------------
# 1b. (Full teardown) Delete operator-managed CRs in THIS namespace BEFORE helm
#     uninstall. The CNPG Cluster + Strimzi Kafka CRs carry finalizers only their
#     operators can clear. The operators are now SHARED and stay running, so they
#     finalize cleanly; we still delete the CRs first (and strip finalizers if the
#     bounded window elapses) so the namespace never hangs in Terminating.
# ---------------------------------------------------------------------------
if ! $SOFT; then
  delete_operator_crs() {  # <fully-qualified resource type> <human label>
    local kind="$1" label="$2" existing res
    existing="$(kubectl get "$kind" -n "$NAMESPACE" -o name 2>/dev/null)" || true
    [[ -z "$existing" ]] && return 0
    info "Deleting $label before namespace removal (lets finalizers clear cleanly)..."
    if kubectl delete "$kind" --all -n "$NAMESPACE" --timeout=120s 2>/dev/null; then
      success "$label deleted."
    else
      warn "$label did not finalize in time — stripping finalizers directly."
      for res in $existing; do
        kubectl patch "$res" -n "$NAMESPACE" --type=merge \
          -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || true
      done
      kubectl delete pods --all -n "$NAMESPACE" \
        --field-selector=status.phase=Succeeded --force --grace-period=0 2>/dev/null || true
    fi
  }

  delete_operator_crs "clusters.postgresql.cnpg.io"     "CNPG PostgreSQL cluster(s)"
  delete_operator_crs "kafkatopics.kafka.strimzi.io"    "Strimzi Kafka topic(s)"
  delete_operator_crs "kafkas.kafka.strimzi.io"         "Strimzi Kafka cluster(s)"
  delete_operator_crs "kafkanodepools.kafka.strimzi.io" "Strimzi Kafka node pool(s)"
fi

# ---------------------------------------------------------------------------
# 2. Helm uninstall. The chart's pre-delete hook Job runs first and removes THIS
#    instance's Dynatrace pipeline, routing entry, and 5 Business Flows from the
#    shared tenant (other instances' objects are untouched).
# ---------------------------------------------------------------------------
if helm status "$RELEASE_NAME" -n "$NAMESPACE" &>/dev/null; then
  info "Uninstalling Helm release: $RELEASE_NAME (deprovisions its Dynatrace objects)..."
  helm uninstall "$RELEASE_NAME" -n "$NAMESPACE" --timeout 5m
  success "Helm release removed."
else
  warn "Helm release '$RELEASE_NAME' not found in namespace '$NAMESPACE'. Skipping."
fi

# ---------------------------------------------------------------------------
# 2b. Delete this instance's DynaKube from the SHARED dynatrace namespace. It is a
#     post-install hook (delete-policy hook-failed), so `helm uninstall` leaves it
#     behind. The shared Dynatrace Operator is still running and clears its
#     finalizers, tearing down this instance's ActiveGate/injection only. Other
#     instances' DynaKubes (named meridian-<their-hash>) are untouched.
# ---------------------------------------------------------------------------
if kubectl get dynakube "$RELEASE_NAME" -n "$DYNATRACE_NAMESPACE" &>/dev/null 2>&1; then
  info "Deleting DynaKube '$RELEASE_NAME' from '$DYNATRACE_NAMESPACE'..."
  kubectl delete dynakube "$RELEASE_NAME" -n "$DYNATRACE_NAMESPACE" --timeout=120s 2>/dev/null \
    || warn "DynaKube deletion did not complete — check: kubectl get dynakube -n $DYNATRACE_NAMESPACE"
fi
# The per-instance token secret (<release>-dynatrace-tokens) is a regular release
# resource, so helm uninstall already removed it; clean it up defensively in case
# of a half-finished uninstall.
kubectl delete secret "${RELEASE_NAME}-dynatrace-tokens" -n "$DYNATRACE_NAMESPACE" 2>/dev/null || true

if $SOFT; then
  success "Soft teardown of '$RELEASE_NAME' complete (Dynatrace objects deprovisioned)."
  exit 0
fi

# ---------------------------------------------------------------------------
# 3. Force-delete leftover pods, then PVCs, in THIS namespace before deleting it.
#    CNPG/Strimzi PVCs are created outside Helm's ownership, so helm uninstall does
#    not remove them; a leftover terminal pod keeps a pvc-protection finalizer that
#    would hold the namespace in Terminating. Reap pods first, then PVCs.
# ---------------------------------------------------------------------------
if kubectl get namespace "$NAMESPACE" &>/dev/null 2>&1; then
  pod_count=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$pod_count" -gt 0 ]]; then
    info "Force-deleting $pod_count leftover pod(s) in namespace $NAMESPACE..."
    kubectl delete pods --all -n "$NAMESPACE" --force --grace-period=0 2>/dev/null || true
  fi
  pvc_count=$(kubectl get pvc -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$pvc_count" -gt 0 ]]; then
    info "Deleting $pvc_count PVC(s) in namespace $NAMESPACE..."
    kubectl delete pvc --all -n "$NAMESPACE" --timeout=60s 2>/dev/null || true
  fi
fi

# ---------------------------------------------------------------------------
# 4. Delete THIS instance's namespace only (never the shared dynatrace namespace).
# ---------------------------------------------------------------------------
if kubectl get namespace "$NAMESPACE" &>/dev/null 2>&1; then
  info "Deleting namespace: $NAMESPACE..."
  kubectl delete namespace "$NAMESPACE" --wait=false 2>/dev/null || true
  if kubectl wait --for=delete namespace/"$NAMESPACE" --timeout=60s 2>/dev/null; then
    success "Namespace $NAMESPACE deleted."
  else
    warn "Namespace $NAMESPACE is still terminating (common with CNPG/Strimzi finalizers)."
    warn "It will finish in the background; 'deploy.sh install' waits for a clearing namespace."
  fi
fi

# ---------------------------------------------------------------------------
# 5. (opt-in) Remove the SHARED operators + their namespaces + CNPG CRDs.
#    DESTRUCTIVE to every other instance — only when none remain.
# ---------------------------------------------------------------------------
if $WITH_SHARED; then
  remaining=$(helm list -A -q --filter '^meridian-' 2>/dev/null | grep -c . || true)
  if [[ "$remaining" -gt 0 ]]; then
    warn "$remaining Meridian instance(s) still present — refusing to remove shared operators."
    warn "Tear those down first, then re-run with --with-shared-operators."
  else
    info "Removing shared operators (no Meridian instances remain)..."
    helm uninstall "$STRIMZI_RELEASE" -n "$STRIMZI_NAMESPACE" --timeout 5m 2>/dev/null || true
    helm uninstall "$CNPG_RELEASE" -n "$CNPG_NAMESPACE" --timeout 5m 2>/dev/null || true
    if helm status dynatrace-operator -n "$DYNATRACE_NAMESPACE" &>/dev/null; then
      helm uninstall dynatrace-operator -n "$DYNATRACE_NAMESPACE" --timeout 5m 2>/dev/null || true
    fi
    for ns in "$STRIMZI_NAMESPACE" "$CNPG_NAMESPACE" "$DYNATRACE_NAMESPACE"; do
      kubectl delete namespace "$ns" --wait=false 2>/dev/null || true
    done
    # CNPG ships its CRDs with resource-policy: keep, so helm leaves them behind.
    cnpg_crds="$(kubectl get crd -o name 2>/dev/null | grep '\.postgresql\.cnpg\.io$' || true)"
    if [[ -n "$cnpg_crds" ]]; then
      info "Removing CNPG CRDs..."
      # shellcheck disable=SC2086
      kubectl delete $cnpg_crds --timeout=60s 2>/dev/null || true
    fi
    success "Shared operators removed."
  fi
fi

success "Teardown of '$RELEASE_NAME' complete."
