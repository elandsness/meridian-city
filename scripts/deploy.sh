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
  for cmd in kubectl helm; do
    if ! command -v "$cmd" &>/dev/null; then
      error "Required tool not found: $cmd"
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
  helm repo add bitnami https://charts.bitnami.com/bitnami || true
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

  # If the app namespace is still terminating from a previous uninstall, wait
  # for it to disappear fully before proceeding — creating resources in a
  # terminating namespace is forbidden by the API server.
  if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    local ns_phase
    ns_phase=$(kubectl get namespace "$NAMESPACE" -o jsonpath='{.status.phase}')
    if [[ "$ns_phase" == "Terminating" ]]; then
      info "Namespace $NAMESPACE is terminating — waiting up to 2m for it to be deleted..."
      kubectl wait --for=delete namespace/"$NAMESPACE" --timeout=120s \
        || { error "Namespace $NAMESPACE is stuck in Terminating. Check for stuck finalizers."; exit 1; }
    else
      # Stamp with Helm ownership metadata so the chart can adopt it rather
      # than failing with "invalid ownership metadata".
      kubectl annotate namespace "$NAMESPACE" \
        "meta.helm.sh/release-name=$RELEASE_NAME" \
        "meta.helm.sh/release-namespace=$NAMESPACE" \
        --overwrite
      kubectl label namespace "$NAMESPACE" \
        "app.kubernetes.io/managed-by=Helm" \
        --overwrite
      info "Adopted existing namespace: $NAMESPACE"
    fi
  fi

  # Ensure Dynatrace operator namespace exists (needed by DynaKube CR)
  if ! kubectl get namespace "$DYNATRACE_NAMESPACE" &>/dev/null; then
    kubectl create namespace "$DYNATRACE_NAMESPACE"
    info "Created namespace: $DYNATRACE_NAMESPACE"
  fi

  # Optional: Docker Hub pull secret for Bitnami images.
  # GKE Autopilot shares outbound IPs, which causes Docker Hub to silently
  # reject anonymous pulls with "not found". Set DOCKERHUB_USERNAME and
  # DOCKERHUB_TOKEN before running this script to authenticate.
  local helm_extra_args=()
  if [[ -n "${DOCKERHUB_USERNAME:-}" && -n "${DOCKERHUB_TOKEN:-}" ]]; then
    kubectl create secret docker-registry dockerhub-pull-secret \
      --docker-server="https://index.docker.io/v1/" \
      --docker-username="$DOCKERHUB_USERNAME" \
      --docker-password="$DOCKERHUB_TOKEN" \
      --namespace "$NAMESPACE" \
      --dry-run=client -o yaml | kubectl apply -f -
    helm_extra_args+=(
      --set "postgresql.global.imagePullSecrets[0]=dockerhub-pull-secret"
      --set "kafka.global.imagePullSecrets[0]=dockerhub-pull-secret"
    )
    info "Docker Hub pull secret configured for Bitnami images"
  else
    warn "DOCKERHUB_USERNAME / DOCKERHUB_TOKEN not set — Bitnami image pulls may fail on GKE Autopilot"
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

  info "Running: helm $cmd $RELEASE_NAME ..."
  helm "$cmd" "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --timeout 20m \
    --wait \
    "${helm_extra_args[@]}" \
    "$@"

  kill "$patch_pid" 2>/dev/null || true
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
