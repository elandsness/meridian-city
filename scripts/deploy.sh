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

  # If the app namespace already exists (e.g. from a previous failed install),
  # stamp it with Helm's ownership metadata so the chart can adopt it rather
  # than failing with "invalid ownership metadata".
  if kubectl get namespace "$NAMESPACE" &>/dev/null; then
    kubectl annotate namespace "$NAMESPACE" \
      "meta.helm.sh/release-name=$RELEASE_NAME" \
      "meta.helm.sh/release-namespace=$NAMESPACE" \
      --overwrite
    kubectl label namespace "$NAMESPACE" \
      "app.kubernetes.io/managed-by=Helm" \
      --overwrite
    info "Adopted existing namespace: $NAMESPACE"
  fi

  # Ensure Dynatrace operator namespace exists (needed by DynaKube CR)
  if ! kubectl get namespace "$DYNATRACE_NAMESPACE" &>/dev/null; then
    kubectl create namespace "$DYNATRACE_NAMESPACE"
    info "Created namespace: $DYNATRACE_NAMESPACE"
  fi

  info "Running: helm $cmd $RELEASE_NAME ..."
  helm "$cmd" "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --timeout 10m \
    --wait \
    "$@"

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
