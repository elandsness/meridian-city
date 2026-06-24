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
#
#   ./scripts/teardown.sh --pf         Stop ALL Meridian port-forwards and exit.
#                                      Non-destructive (touches no cluster
#                                      resources) — use it to clear stale or
#                                      orphaned forwards that accumulate across
#                                      repeated deploys.
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

_PF_PIDS_FILE="/tmp/meridian-pf-pids"
# Matches the kubectl port-forward processes deploy.sh starts for this
# namespace's services (see scripts/deploy.sh _pf_loop). Anchored on
# "port-forward ... -n <ns>" rather than on "kubectl": kuberlr runs the real
# binary as e.g. "kubectl1.36.2 port-forward ...", so a literal "kubectl
# port-forward" match (the old fallback) silently missed every kuberlr forward.
_PF_KUBECTL_PATTERN="port-forward .*-n ${NAMESPACE}"

# Durably stop EVERY Meridian port-forward: the loops tracked by the most recent
# deploy run AND orphans from earlier runs.
#
# Why the PID file alone is not enough: deploy.sh runs each port-forward inside a
# restart loop (it relaunches kubectl whenever a pod is replaced) and writes only
# the CURRENT run's loop PIDs to $_PF_PIDS_FILE, overwriting it each run. Repeated
# `deploy.sh upgrade`s (which never teardown in between) therefore leave the prior
# runs' loops untracked, and they pile up — each respawning kubectl and fighting
# over ports 8080/8081/3000/3001. Killing only the kubectl children is futile: the
# loops respawn them after a 3s sleep.
#
# So we kill the restart-loop PARENTS first (they stop respawning), then the
# kubectl children. Orphaned loops are found by walking up from every live kubectl
# port-forward to its parent — adopting it only when that parent is itself a
# deploy.sh process and not PID 1, so we never kill init or an unrelated shell.
stop_port_forwards() {
  local stopped=false pid ppid pcmd p
  local -a loop_pids=()

  # (a) Loops tracked by the most recent deploy run.
  if [[ -f "$_PF_PIDS_FILE" ]]; then
    while IFS= read -r pid; do
      [[ -n "$pid" ]] && loop_pids+=("$pid")
    done < "$_PF_PIDS_FILE"
  fi

  # (b) Orphaned loops from earlier runs: the deploy.sh parent of each live
  #     kubectl port-forward child (the PID file no longer references them).
  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    [[ -z "$ppid" || "$ppid" == "1" ]] && continue
    pcmd=$(ps -o command= -p "$ppid" 2>/dev/null || true)
    [[ "$pcmd" == *deploy.sh* ]] && loop_pids+=("$ppid")
  done < <(pgrep -f "$_PF_KUBECTL_PATTERN" 2>/dev/null || true)

  # Kill loop parents first (stops respawning), then any kubectl still up
  # (covers a bare kubectl left by a Ctrl+C'd manual `deploy.sh port-forward`).
  if [[ ${#loop_pids[@]} -gt 0 ]]; then
    for p in "${loop_pids[@]}"; do
      if kill "$p" 2>/dev/null; then stopped=true; fi
      pkill -P "$p" 2>/dev/null || true  # reap its kubectl child
    done
  fi
  if pkill -f "$_PF_KUBECTL_PATTERN" 2>/dev/null; then stopped=true; fi

  rm -f "$_PF_PIDS_FILE"
  $stopped && success "Port-forwards stopped." || info "No port-forwards were running."
}

SOFT=false
PF_ONLY=false
case "${1:-}" in
  --soft) SOFT=true ;;
  --pf)   PF_ONLY=true ;;
esac

# Port-forward-only mode changes no cluster state, so it runs immediately
# without the teardown confirmation prompt.
if $PF_ONLY; then
  info "Stopping all Meridian port-forwards (no cluster changes)..."
  stop_port_forwards
  exit 0
fi

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
# 1. Kill port-forwards (loops + orphans — see stop_port_forwards above)
# ---------------------------------------------------------------------------
info "Stopping port-forwards..."
stop_port_forwards

# ---------------------------------------------------------------------------
# 1b. (Full teardown only) Delete operator-managed CRs BEFORE uninstalling the
#     operators.
#     The CNPG Cluster (created as a post-install hook with
#     hook-delete-policy: hook-failed, so 'helm uninstall' leaves it behind)
#     and the Strimzi Kafka CRs carry finalizers (e.g. cnpg.io/cluster) that
#     ONLY their operators can clear. 'helm uninstall' removes those operators.
#     If the CRs are still present when that happens, their finalizers can
#     never be processed: the CRs hang in Terminating, the postgres pod is
#     left 'Completed', and the whole namespace is stuck Terminating forever
#     (this was the teardown bug).
#     So while the operators are still running, delete the CRs and give them a
#     bounded window to finalize cleanly. If that window elapses — e.g. the
#     operator is already gone from a previous half-finished teardown — strip
#     the finalizers directly so an already-stuck namespace can recover.
# ---------------------------------------------------------------------------
if ! $SOFT; then
  delete_operator_crs() {  # <fully-qualified resource type> <human label>
    local kind="$1" label="$2" existing res
    # -o name returns nothing (and errors) when the CRD/operator is already
    # gone; treat that as "nothing to do".
    existing="$(kubectl get "$kind" -n "$NAMESPACE" -o name 2>/dev/null)" || true
    [[ -z "$existing" ]] && return 0
    info "Deleting $label before operator removal (lets finalizers clear cleanly)..."
    if kubectl delete "$kind" --all -n "$NAMESPACE" --timeout=120s 2>/dev/null; then
      success "$label deleted."
    else
      warn "$label did not finalize in time — stripping finalizers directly."
      for res in $existing; do
        kubectl patch "$res" -n "$NAMESPACE" --type=merge \
          -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || true
      done
      # Reap any leftover completed/succeeded pods the operator can no longer collect.
      kubectl delete pods --all -n "$NAMESPACE" \
        --field-selector=status.phase=Succeeded --force --grace-period=0 2>/dev/null || true
    fi
  }

  delete_operator_crs "clusters.postgresql.cnpg.io"   "CNPG PostgreSQL cluster(s)"
  delete_operator_crs "kafkatopics.kafka.strimzi.io"  "Strimzi Kafka topic(s)"
  delete_operator_crs "kafkas.kafka.strimzi.io"       "Strimzi Kafka cluster(s)"
  delete_operator_crs "kafkanodepools.kafka.strimzi.io" "Strimzi Kafka node pool(s)"
fi

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
# 3. Force-delete leftover pods, then PVCs, before namespace deletion.
#    CNPG and Strimzi operators create PVCs outside of Helm's ownership, so
#    helm uninstall does not remove them.  Leaving them behind causes Flyway
#    schema-history conflicts and Kafka offset conflicts on the next fresh
#    install.  Namespace deletion normally cascades to PVCs, but we delete
#    them explicitly first so the namespace is not held in Terminating state
#    by PVC finalizers.
#
#    Pods must be reaped FIRST.  A pod left in a terminal (Completed) phase —
#    e.g. the CNPG instance pod the operator shut down but didn't delete
#    before 'helm uninstall' removed the operator — keeps the
#    kubernetes.io/pvc-protection finalizer on its PVC.  That finalizer blocks
#    PVC deletion AND holds the whole namespace in Terminating indefinitely
#    (kubectl confirms: "pvc-protection in 1 resource instances").  Nothing
#    else collects such a pod once its operator is gone, so we force-delete
#    it; the PVC's finalizer then releases and both the PVC and the namespace
#    can finish terminating.
# ---------------------------------------------------------------------------
for ns in "$NAMESPACE" "$DYNATRACE_NAMESPACE"; do
  if kubectl get namespace "$ns" &>/dev/null 2>&1; then
    pod_count=$(kubectl get pods -n "$ns" --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$pod_count" -gt 0 ]]; then
      info "Force-deleting $pod_count leftover pod(s) in namespace $ns..."
      kubectl delete pods --all -n "$ns" --force --grace-period=0 2>/dev/null || true
    fi
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

# ---------------------------------------------------------------------------
# 5. Remove the orphaned CNPG CRDs.
#    The cloudnative-pg sub-chart ships its CRDs with
#    helm.sh/resource-policy: keep, so 'helm uninstall' deliberately leaves
#    every *.postgresql.cnpg.io CRD behind ("kept due to the resource policy").
#    They are cluster-scoped — they don't block namespace deletion — but they
#    accumulate across teardowns. The CNPG Cluster CR was already deleted in
#    step 1b, so no custom resources remain and the CRDs delete immediately.
# ---------------------------------------------------------------------------
cnpg_crds="$(kubectl get crd -o name 2>/dev/null | grep '\.postgresql\.cnpg\.io$' || true)"
if [[ -n "$cnpg_crds" ]]; then
  info "Removing orphaned CNPG CRDs..."
  # shellcheck disable=SC2086  # intentional word-splitting: one delete per CRD name
  if kubectl delete $cnpg_crds --timeout=60s 2>/dev/null; then
    success "CNPG CRDs removed."
  else
    warn "Some CNPG CRDs did not delete — a lingering CNPG resource may still hold a finalizer."
    warn "Check: kubectl get clusters.postgresql.cnpg.io -A"
  fi
fi

success "Teardown complete."
