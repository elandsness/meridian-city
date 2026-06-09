#!/usr/bin/env bash
# =============================================================================
# Meridian City Platform — Deploy Script
# =============================================================================
# Usage:
#   ./scripts/deploy.sh repos                          Add all required Helm repos
#   ./scripts/deploy.sh install [helm flags...]        Full install (infra + app)
#   ./scripts/deploy.sh upgrade [helm flags...]        Upgrade existing release
#   ./scripts/deploy.sh status                         Show pod status
#   ./scripts/deploy.sh port-forward                   Port-forward UIs to localhost
# =============================================================================
set -euo pipefail

RELEASE_NAME="${RELEASE_NAME:-meridian}"
CHART_DIR="$(cd "$(dirname "$0")/.." && pwd)/helm"
NAMESPACE="${NAMESPACE:-meridian}"
DYNATRACE_NAMESPACE="dynatrace"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

check_prerequisites() {
  local missing=0
  for tool in kubectl helm; do
    if ! command -v "$tool" &>/dev/null; then
      error "Required tool not found: $tool"
      missing=1
    fi
  done
  if [[ $missing -eq 1 ]]; then
    error "Install missing tools and try again."
    exit 1
  fi

  if ! kubectl cluster-info &>/dev/null; then
    error "kubectl cannot reach a cluster. Check your kubeconfig."
    exit 1
  fi

  success "Prerequisites OK"
}

add_repos() {
  info "Adding Helm chart repositories..."
  helm repo add cloudnative-pg https://cloudnative-pg.github.io/charts || true
  helm repo add strimzi https://strimzi.io/charts/ || true
  helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts || true
  helm repo add dynatrace \
    https://raw.githubusercontent.com/Dynatrace/dynatrace-operator/main/config/helm/repos/stable || true
  helm repo update
  success "Helm repos updated."

  info "Resolving Helm dependencies..."
  helm dependency update "$CHART_DIR"
  success "Dependencies resolved."
}

install_or_upgrade() {
  local cmd="$1"
  shift

  check_prerequisites

  # Ensure the app namespace exists and carries Helm ownership labels.
  # Three cases:
  #   Terminating → wait for it to disappear, then fall through to create
  #   Active      → stamp with Helm labels so the chart can adopt it
  #   Missing     → create with Helm labels so the chart owns it from the start
  if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    local ns_phase
    ns_phase=$(kubectl get namespace "$NAMESPACE" -o jsonpath='{.status.phase}')
    if [[ "$ns_phase" == "Terminating" ]]; then
      info "Namespace $NAMESPACE is terminating — waiting up to 2m for deletion..."
      kubectl wait --for=delete namespace/"$NAMESPACE" --timeout=120s \
        || { error "Namespace $NAMESPACE is stuck in Terminating. Check for stuck finalizers."; exit 1; }
      # Fall through: namespace is now gone, create it fresh below.
    fi
  fi
  if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    kubectl create namespace "$NAMESPACE"
    info "Created namespace: $NAMESPACE"
  fi
  kubectl annotate namespace "$NAMESPACE" \
    "meta.helm.sh/release-name=$RELEASE_NAME" \
    "meta.helm.sh/release-namespace=$NAMESPACE" \
    --overwrite
  kubectl label namespace "$NAMESPACE" \
    "app.kubernetes.io/managed-by=Helm" \
    --overwrite
  info "Namespace ready: $NAMESPACE"

  # Ensure Dynatrace operator namespace exists (needed by DynaKube CR)
  if ! kubectl get namespace "$DYNATRACE_NAMESPACE" &>/dev/null; then
    kubectl create namespace "$DYNATRACE_NAMESPACE"
    info "Created namespace: $DYNATRACE_NAMESPACE"
  fi

  # GKE Autopilot cold-start: the OTel collector chart does not expose
  # progressDeadlineSeconds as a value, so the default 600s can be exceeded
  # while waiting for node provisioning + large image pull. Patch it in the
  # background the moment Helm creates the deployment.
  local otel_deploy="${RELEASE_NAME}-opentelemetry-collector"
  (
    until kubectl get deployment "$otel_deploy" -n "$NAMESPACE" &>/dev/null; do
      sleep 5
    done
    kubectl patch deployment "$otel_deploy" -n "$NAMESPACE" \
      --type=merge -p '{"spec":{"progressDeadlineSeconds":1800}}' &>/dev/null
    info "Patched $otel_deploy: progressDeadlineSeconds=1800"
  ) &
  local patch_pid=$!

  # Background progress reporter: prints a pod summary every 20s so the
  # terminal isn't silent during the long GKE Autopilot cold-start wait.
  (
    while true; do
      sleep 20
      local pods running total errors
      pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null) || continue
      total=$(echo "$pods" | grep -c . 2>/dev/null || true)
      running=$(echo "$pods" | grep -c " Running " 2>/dev/null || true)
      errors=$(echo "$pods" | grep -cE "Error|CrashLoop|OOMKill|ImagePull|ErrImage" 2>/dev/null || true)
      [[ $total -eq 0 ]] && continue
      if [[ $errors -gt 0 ]]; then
        echo -e "${BLUE}[INFO]${NC}  pods: ${GREEN}${running} running${NC} / ${total} total  ${RED}(${errors} errors)${NC}"
      else
        echo -e "${BLUE}[INFO]${NC}  pods: ${GREEN}${running} running${NC} / ${total} total"
      fi
    done
  ) &
  local progress_pid=$!

  # Pre-apply CRDs before helm install so the REST mapper discovers them at startup.
  # Helm's KubeClient.Build() uses a mapper locked at client init — CRDs applied
  # during install (from crds/) don't refresh it, so any template type not yet in
  # the cluster causes a "no matches for kind" build failure.
  if [[ -d "${CHART_DIR}/crds" ]] && [[ -n "$(ls -A "${CHART_DIR}/crds/" 2>/dev/null)" ]]; then
    info "Pre-applying CRDs from helm/crds/ ..."
    kubectl apply --server-side --force-conflicts -f "${CHART_DIR}/crds/"
    kubectl get -f "${CHART_DIR}/crds/" -o name 2>/dev/null \
      | xargs -r kubectl wait --for=condition=Established --timeout=60s 2>/dev/null || true
    # Flush the client-side discovery cache so Helm re-queries the API server.
    # Both kubectl and Helm share ~/.kube/cache/discovery/; a stale cache causes
    # "no matches for kind" even when CRDs are fully established.
    rm -rf "${HOME}/.kube/cache/discovery/"
    success "CRDs established."
  fi

  info "Running: helm $cmd $RELEASE_NAME ..."
  # --wait is intentionally omitted: Java services crash-loop until DB is ready,
  # which would deadlock the post-install hooks that provision the DB.
  # Instead, a post-install Job (wait-for-operators) ensures operators are up
  # before the CNPG Cluster and Strimzi Kafka CRs are created (hook weights 1→5→10).
  helm "$cmd" "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --timeout 20m \
    "$@"

  # Helm has submitted resources and hooks are running. Wait for everything to converge.
  info "Resources submitted. Waiting for full platform readiness (~3-5 min on first install)..."
  warn "Java services will show CrashLoopBackOff briefly while DB initializes — this is expected."

  kubectl wait pods \
    --for=condition=ready \
    --selector='app.kubernetes.io/part-of=meridian-city-platform' \
    -n "$NAMESPACE" \
    --timeout=900s 2>/dev/null || true

  kill "$patch_pid" "$progress_pid" 2>/dev/null || true
  success "Deployment complete."
  echo ""
  kubectl get pods -n "$NAMESPACE"
}

show_status() {
  echo ""
  info "=== Pods in namespace: $NAMESPACE ==="
  kubectl get pods -n "$NAMESPACE" -o wide
  echo ""
  info "=== Services ==="
  kubectl get svc -n "$NAMESPACE"
  echo ""
  info "=== Ingresses ==="
  kubectl get ingress -n "$NAMESPACE" 2>/dev/null || true
}

port_forward() {
  info "Starting port-forwards (Ctrl+C to stop)..."
  info "  Public Portal   → http://localhost:8080"
  info "  Ops Dashboard   → http://localhost:8081  (login: demo / dynatrace)"
  info "  API Gateway     → http://localhost:3000"
  info "  Demo Control    → http://localhost:3001"

  kubectl port-forward svc/public-portal   8080:80   -n "$NAMESPACE" &
  kubectl port-forward svc/ops-dashboard   8081:80   -n "$NAMESPACE" &
  kubectl port-forward svc/api-gateway     3000:3000 -n "$NAMESPACE" &
  kubectl port-forward svc/demo-control-api 3001:3001 -n "$NAMESPACE" &

  trap 'kill $(jobs -p) 2>/dev/null; echo; info "Port-forwards stopped."' EXIT INT TERM
  wait
}

# ---------------------------------------------------------------------------
case "${1:-}" in
  repos)
    add_repos
    ;;
  install)
    shift
    install_or_upgrade install "$@"
    ;;
  upgrade)
    shift
    install_or_upgrade upgrade "$@"
    ;;
  status)
    show_status
    ;;
  port-forward)
    port_forward
    ;;
  *)
    echo "Usage: $0 {repos|install|upgrade|status|port-forward} [helm flags...]"
    echo ""
    echo "Examples:"
    echo "  $0 repos"
    echo "  $0 install -f helm/values-custom.yaml"
    echo "  $0 install -f helm/values-custom.yaml -f helm/values-dev.yaml"
    echo "  $0 upgrade -f helm/values-custom.yaml --set global.imageTag=v1.2.0"
    echo "  $0 status"
    echo "  $0 port-forward"
    exit 1
    ;;
esac
