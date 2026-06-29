#!/usr/bin/env bash
# =============================================================================
# Meridian City Platform — Deploy Script
# =============================================================================
# Usage:
#   ./scripts/deploy.sh repos                          Add all required Helm repos
#   ./scripts/deploy.sh install [helm flags...]        Full install (infra + app +
#                                                      seed data + port-forwards)
#   ./scripts/deploy.sh upgrade [helm flags...]        Upgrade existing release, then
#                                                      restart app workloads so the
#                                                      floating :latest images are
#                                                      re-pulled (restarts port-forwards too)
#   ./scripts/deploy.sh seed [--reset] [--check]      Seed / re-seed demo data
#   ./scripts/deploy.sh status                         Show pod status
#   ./scripts/deploy.sh port-forward                   Start port-forwards only
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHART_DIR="$(cd "$(dirname "$0")/.." && pwd)/helm"
DYNATRACE_NAMESPACE="dynatrace"

# ---------------------------------------------------------------------------
# Shared cluster-singleton operators — installed ONCE, reused by every instance.
# Override the namespaces/release names via env if your cluster already hosts them.
# ---------------------------------------------------------------------------
CNPG_NAMESPACE="${CNPG_NAMESPACE:-cnpg-system}"
CNPG_RELEASE="${CNPG_RELEASE:-cnpg}"
STRIMZI_NAMESPACE="${STRIMZI_NAMESPACE:-strimzi-system}"
STRIMZI_RELEASE="${STRIMZI_RELEASE:-strimzi}"

# ---------------------------------------------------------------------------
# Per-instance identity (multi-tenancy). The Helm release name is meridian-<hash>
# and the namespace matches it, so concurrent installs never collide. Pin any of
# these via env to target a specific instance; otherwise `install` generates a
# fresh hash and the other commands auto-detect the instance. See resolve_instance.
# ---------------------------------------------------------------------------
RELEASE_NAME="${RELEASE_NAME:-}"
NAMESPACE="${NAMESPACE:-}"
INSTANCE_HASH="${INSTANCE_HASH:-}"

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

# Generate a short per-instance hash (4 chars, base36: a-z0-9).
gen_hash() { LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 4; }

# Resolve RELEASE_NAME / NAMESPACE / INSTANCE_HASH for this invocation ($1 = subcommand).
#   install : generate a fresh hash unless RELEASE_NAME / INSTANCE_HASH is pinned.
#   others  : target an existing instance — use RELEASE_NAME if given, else
#             auto-detect the sole meridian-* Helm release (error on 0 or >1).
resolve_instance() {
  local cmd="$1"
  if [[ -n "$RELEASE_NAME" ]]; then
    [[ -z "$INSTANCE_HASH" ]] && INSTANCE_HASH="${RELEASE_NAME#meridian-}"
  elif [[ -n "$INSTANCE_HASH" ]]; then
    RELEASE_NAME="meridian-${INSTANCE_HASH}"
  elif [[ "$cmd" == "install" ]]; then
    INSTANCE_HASH="$(gen_hash)"
    RELEASE_NAME="meridian-${INSTANCE_HASH}"
  else
    local found n
    found=$(helm list -A -q --filter '^meridian-' 2>/dev/null || true)
    n=$(printf '%s' "$found" | grep -c . || true)
    if [[ "$n" -eq 1 ]]; then
      RELEASE_NAME="$found"
      INSTANCE_HASH="${RELEASE_NAME#meridian-}"
    elif [[ "$n" -eq 0 ]]; then
      error "No Meridian instance found. Pin one with RELEASE_NAME=meridian-<hash>, or run: $0 install"
      exit 1
    else
      error "Multiple Meridian instances found — set RELEASE_NAME=meridian-<hash> to pick one:"
      printf '%s\n' "$found" | sed 's/^/    /' >&2
      exit 1
    fi
  fi
  NAMESPACE="${NAMESPACE:-$RELEASE_NAME}"
  info "Instance:  release=${RELEASE_NAME}  namespace=${NAMESPACE}  hash=${INSTANCE_HASH:-<none>}"
}

# Install the cluster-singleton operators ONCE (idempotent: skipped if their Helm
# release already exists, so concurrent instance deploys never disturb them).
# These own cluster-scoped CRDs/webhooks, so they MUST be shared, not per-instance.
ensure_shared_operators() {
  if helm status "$CNPG_RELEASE" -n "$CNPG_NAMESPACE" &>/dev/null; then
    info "Shared CloudNativePG operator present (${CNPG_RELEASE}/${CNPG_NAMESPACE})."
  else
    info "Installing shared CloudNativePG operator into '${CNPG_NAMESPACE}'..."
    helm upgrade --install "$CNPG_RELEASE" cloudnative-pg/cloudnative-pg \
      --namespace "$CNPG_NAMESPACE" --create-namespace \
      --set crds.create=true --wait --timeout 5m
    success "CloudNativePG operator ready."
  fi

  if helm status "$STRIMZI_RELEASE" -n "$STRIMZI_NAMESPACE" &>/dev/null; then
    info "Shared Strimzi operator present (${STRIMZI_RELEASE}/${STRIMZI_NAMESPACE})."
  else
    info "Installing shared Strimzi operator into '${STRIMZI_NAMESPACE}' (watchAnyNamespace=true)..."
    helm upgrade --install "$STRIMZI_RELEASE" strimzi/strimzi-kafka-operator \
      --namespace "$STRIMZI_NAMESPACE" --create-namespace \
      --set watchAnyNamespace=true --wait --timeout 5m
    success "Strimzi operator ready."
  fi

  # The shared operators just (maybe) registered cluster-scoped CRDs. Helm's
  # KubeClient locks its REST mapper at client init, so flush the shared discovery
  # cache or the umbrella install fails with "no matches for kind: Kafka/Cluster".
  rm -rf "${HOME}/.kube/cache/discovery/"
}

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

# Recreate the app Deployments and wait for them to come back ready. Targets only
# our app workloads via the part-of selector — never the DB/Kafka CRs or the
# CNPG/Strimzi/OTel operator Deployments. Used to pull fresh :latest images on
# upgrade and to (re)trigger OneAgent injection.
restart_app_workloads() {
  kubectl rollout restart deployment -n "$NAMESPACE" \
    -l 'app.kubernetes.io/part-of=meridian-city-platform'
  sleep 10  # let the rollout begin so we wait on the new pods, not the old ready ones
  kubectl wait pods \
    --for=condition=ready \
    --selector='app.kubernetes.io/part-of=meridian-city-platform' \
    -n "$NAMESPACE" \
    --timeout=600s 2>/dev/null \
    || warn "Pods still settling after restart — check: ./scripts/deploy.sh status"
}

# When llm.provider == "local", the chart deploys an in-cluster Ollama
# (helm/templates/ollama.yaml). Ollama starts with no models, so pull the
# configured model into it once it is ready. We discover the provider/model by
# reading the annotation the chart stamps on the ollama Deployment — that
# Deployment (and thus the annotation) only exists when provider is "local", so
# this is a clean no-op for every other provider. `ollama pull` is idempotent —
# a no-op when the model is already present (e.g. served from the persistent
# volume on a re-deploy).
ensure_local_llm_model() {
  local model
  model=$(kubectl get deployment ollama -n "$NAMESPACE" \
    -o jsonpath='{.metadata.annotations.meridian\.city/ollama-model}' 2>/dev/null || true)
  [[ -n "$model" ]] || return 0  # provider is not "local" — no ollama deployment

  echo ""
  info "LLM provider is 'local' — ensuring Ollama has model '$model'..."
  if ! kubectl rollout status deployment/ollama -n "$NAMESPACE" --timeout=600s; then
    warn "Ollama did not become ready in time — skipping model pull. Pull it later with:"
    warn "  kubectl exec -n $NAMESPACE deploy/ollama -- ollama pull $model"
    return 0
  fi

  info "Pulling '$model' into Ollama (first pull downloads several GB — this can take a while)..."
  if kubectl exec -n "$NAMESPACE" deploy/ollama -- ollama pull "$model"; then
    success "Ollama model '$model' is ready."
  else
    warn "Could not pull '$model' into Ollama. Retry with:"
    warn "  kubectl exec -n $NAMESPACE deploy/ollama -- ollama pull $model"
  fi
}

install_or_upgrade() {
  local cmd="$1"
  shift
  local dt_enabled=false

  check_prerequisites
  resolve_instance "$cmd"

  # The cluster-singleton operators are no longer sub-charts. Remove any stale
  # operator sub-chart tarballs left in charts/ by an older 'helm dependency
  # update' — Helm loads sub-charts from charts/ regardless of Chart.yaml, so a
  # leftover would redeploy a per-release operator into the instance namespace.
  rm -f "${CHART_DIR}"/charts/dynatrace-operator-*.tgz \
        "${CHART_DIR}"/charts/cloudnative-pg-*.tgz \
        "${CHART_DIR}"/charts/strimzi-kafka-operator-*.tgz 2>/dev/null || true

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
  local patch_pid="" progress_pid=""
  # Kill background helpers on Ctrl+C, normal exit, or SIGTERM.
  trap 'kill ${patch_pid:-} ${progress_pid:-} 2>/dev/null; trap - EXIT INT TERM' EXIT INT TERM

  local otel_deploy="${RELEASE_NAME}-opentelemetry-collector"
  (
    until kubectl get deployment "$otel_deploy" -n "$NAMESPACE" &>/dev/null; do
      sleep 5
    done
    kubectl patch deployment "$otel_deploy" -n "$NAMESPACE" \
      --type=merge -p '{"spec":{"progressDeadlineSeconds":1800}}' &>/dev/null
    info "Patched $otel_deploy: progressDeadlineSeconds=1800"
  ) &
  patch_pid=$!

  # Background progress reporter: prints a pod summary every 20s.
  # Loop condition checks that the parent script is still alive (kill -0 $$
  # returns 0 as long as the process exists). Stops automatically once all
  # pods are running, or when the parent exits / is Ctrl+C'd.
  local parent_pid=$$
  (
    while kill -0 "$parent_pid" 2>/dev/null; do
      sleep 20
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
      # Stop once everything is running and stable.
      [[ $errors -eq 0 && $running -eq $total && $total -gt 0 ]] && break
    done
  ) &
  progress_pid=$!

  # Ensure the shared cluster-singleton operators (CloudNativePG + Strimzi) are
  # installed and ready BEFORE the instance install. They own the cluster-scoped
  # CRDs (Cluster, Kafka/KafkaTopic) this chart's CRs reference, so this both
  # registers those kinds and flushes the discovery cache — replacing the old
  # per-release helm/crds/ pre-apply, which would have collided across instances.
  ensure_shared_operators

  # ---------------------------------------------------------------------------
  # Dynatrace Operator — installed as its OWN Helm release in the 'dynatrace'
  # namespace, NOT as a sub-chart. A sub-chart always deploys into the parent
  # release namespace (meridian), but the operator only reconciles DynaKube CRs
  # in its own namespace, and the DynaKube lives in 'dynatrace'. Mismatched
  # namespaces = the DynaKube never reconciles and no OneAgent injection happens.
  #
  # We install it only when Dynatrace is actually configured, detected by
  # rendering the chart and checking whether the DynaKube template emits anything
  # (it is gated on dynatrace.operator.enabled && dynatrace.apiUrl). installCRD is
  # left at the chart default so the operator release owns the dynatrace CRDs —
  # they were removed from helm/crds/ to avoid cross-release ownership conflicts.
  # ---------------------------------------------------------------------------
  if helm template "$RELEASE_NAME" "$CHART_DIR" --namespace "$NAMESPACE" "$@" 2>/dev/null \
       | grep -q "kind: DynaKube"; then
    dt_enabled=true
    info "Dynatrace configured — installing the Dynatrace Operator into '$DYNATRACE_NAMESPACE'..."
    if helm upgrade --install dynatrace-operator dynatrace/dynatrace-operator \
         --namespace "$DYNATRACE_NAMESPACE" \
         --create-namespace \
         --wait --timeout 5m; then
      success "Dynatrace Operator ready in '$DYNATRACE_NAMESPACE'."
      # The operator just registered the DynaKube CRD; flush the shared discovery
      # cache so the umbrella install's hook client can resolve kind: DynaKube.
      rm -rf "${HOME}/.kube/cache/discovery/"
    else
      warn "Dynatrace Operator install did not complete — OneAgent injection will be unavailable."
      warn "The rest of the platform will still deploy. Check: kubectl get pods -n $DYNATRACE_NAMESPACE"
    fi
  else
    info "Dynatrace not configured (DynaKube does not render) — skipping operator install."
  fi

  # MULTI-TENANCY: the Log Module + ActiveGate are node/cluster-level singletons —
  # only ONE DynaKube per cluster may run them (the webhook rejects a second). Detect
  # whether ANOTHER instance already owns cluster monitoring (a DynaKube with
  # logMonitoring set, excluding this instance's own) and, if so, deploy this
  # instance's DynaKube as applicationMonitoring-only. The single owner's Log Module
  # captures every namespace's logs, so all instances' business events still flow.
  # A present logMonitoring (empty object) serializes as "={}" (or "=map[]" on some
  # kubectl versions); an absent one is just "=". Count non-self DynaKubes that have it.
  local cluster_mon=true others
  others=$(kubectl get dynakube -n "$DYNATRACE_NAMESPACE" \
    -o jsonpath='{range .items[*]}{.metadata.name}={.spec.logMonitoring}{"\n"}{end}' 2>/dev/null \
    | grep -v "^${RELEASE_NAME}=" | grep -cE '=.+' || true)
  if [[ "${others:-0}" -gt 0 ]]; then
    cluster_mon=false
    info "Cluster monitoring already owned by another instance — this DynaKube does applicationMonitoring only."
  else
    info "This instance will own cluster monitoring (Log Module + ActiveGate) for the cluster."
  fi

  info "Running: helm $cmd $RELEASE_NAME ..."
  # --wait is intentionally omitted: Java services crash-loop until DB is ready,
  # which would deadlock the post-install hooks. The shared operators are already
  # ready (ensure_shared_operators ran with --wait), so the namespaced CR hooks
  # (CNPG Cluster / Strimzi Kafka, weight 5) reconcile as soon as they're applied.
  helm "$cmd" "$RELEASE_NAME" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    --timeout 20m \
    --set global.instanceHash="$INSTANCE_HASH" \
    --set dynatrace.clusterMonitoring.enabled="$cluster_mon" \
    "$@"

  # Helm has submitted resources and hooks are running. Wait for everything to converge.
  info "Resources submitted. Waiting for full platform readiness (up to 15 min on first install)..."
  warn "Kafka broker takes 3–5 min to provision on first install."
  warn "Kafka-dependent pods will show Init:0/1 until it is ready — this is expected."

  # kubectl wait exits immediately with success when the label selector matches no pods.
  # This is a race: pods may not be scheduled yet when helm returns.
  # Block here until at least one platform pod exists so kubectl wait has something to watch.
  until kubectl get pods -n "$NAMESPACE" \
      -l 'app.kubernetes.io/part-of=meridian-city-platform' \
      --no-headers 2>/dev/null | grep -q .; do
    sleep 5
  done

  kubectl wait pods \
    --for=condition=ready \
    --selector='app.kubernetes.io/part-of=meridian-city-platform' \
    -n "$NAMESPACE" \
    --timeout=900s 2>/dev/null || true

  kill "$patch_pid" "$progress_pid" 2>/dev/null || true
  trap - EXIT INT TERM  # clear install-time trap; port_forward sets its own

  # Show actual pod state and only claim success when pods are genuinely ready.
  echo ""
  kubectl get pods -n "$NAMESPACE"
  echo ""
  local _total _ready
  _total=$(kubectl get pods -n "$NAMESPACE" \
      -l 'app.kubernetes.io/part-of=meridian-city-platform' \
      --no-headers 2>/dev/null | wc -l | tr -d ' ')
  _ready=$(kubectl get pods -n "$NAMESPACE" \
      -l 'app.kubernetes.io/part-of=meridian-city-platform' \
      --no-headers 2>/dev/null \
      | awk '{ split($2,a,"/"); if (a[1]+0==a[2]+0 && a[2]+0>0) c++ } END { print c+0 }')
  if [[ "$_total" -gt 0 && "$_ready" -eq "$_total" ]]; then
    success "Deployment complete — all $_total pods ready."
  else
    warn "Deployment submitted — ${_ready:-0}/${_total:-0} pods ready after 15 min wait."
    warn "Some services may still be initializing."
    warn "Check status with: ./scripts/deploy.sh status"
  fi

  # Seed demo data on a fresh install (idempotent — safe to re-run on upgrade too).
  echo ""
  info "Seeding demo data..."
  if RELEASE_NAME="$RELEASE_NAME" NAMESPACE="$NAMESPACE" bash "${SCRIPT_DIR}/seed-data.sh"; then
    echo ""
  else
    warn "Seed data failed — platform is up but demo data may be missing."
    warn "Re-run manually: ./scripts/deploy.sh seed"
    echo ""
  fi

  # On upgrade, force the app workloads onto fresh images. Images use the floating
  # :latest tag (imagePullPolicy: Always), so a code-only change is invisible to
  # Helm — it sees no manifest diff and leaves the old pods running, and 'Always'
  # only pulls when a pod starts, never into a live pod. A rollout restart recreates
  # them so they pull the new :latest. (Install pods are already fresh, so this is
  # upgrade-only. When Dynatrace is enabled the new pods also get OneAgent-injected,
  # making the block below a no-op on a normal upgrade.)
  if [[ "$cmd" == "upgrade" ]]; then
    echo ""
    info "Restarting app workloads to pull fresh :latest images..."
    restart_app_workloads
    success "App workloads restarted on fresh images."
  fi

  # OneAgent injection happens at pod creation, but on a fresh install the app
  # pods come up before the DynaKube (a post-install hook) has reconciled — so
  # they start un-instrumented and need one restart. We wait for the DynaKube to
  # be Running first (an injected init container can stall if it starts before the
  # code module is ready), and we skip the restart when pods are already injected
  # (e.g. a clean upgrade) to avoid needless churn.
  if [[ "$dt_enabled" == true ]]; then
    echo ""
    info "Ensuring OneAgent instrumentation of the app pods..."
    local _dk_phase="" _waited=0
    while [[ $_waited -lt 300 ]]; do
      _dk_phase=$(kubectl get dynakube "$RELEASE_NAME" -n "$DYNATRACE_NAMESPACE" \
        -o jsonpath='{.status.phase}' 2>/dev/null || true)
      [[ "$_dk_phase" == "Running" ]] && break
      sleep 10
      _waited=$((_waited + 10))
    done

    if [[ "$_dk_phase" != "Running" ]]; then
      warn "DynaKube did not reach Running within 5m (phase: ${_dk_phase:-unknown}) — skipping auto-restart."
      warn "Once it is Running, instrument the app pods with:"
      warn "  kubectl -n $NAMESPACE rollout restart deploy -l app.kubernetes.io/part-of=meridian-city-platform"
    elif kubectl get pods -n "$NAMESPACE" \
           -l 'app.kubernetes.io/part-of=meridian-city-platform' \
           -o jsonpath='{range .items[*].spec.initContainers[*]}{.name}{"\n"}{end}' 2>/dev/null \
           | grep -qx 'dynatrace-operator'; then
      success "App pods are already OneAgent-injected — no restart needed."
    else
      info "DynaKube is Running but the app pods predate it — restarting once so OneAgent injects..."
      restart_app_workloads
      success "App workloads restarted — OneAgent instrumentation active."
    fi
  fi

  # If the local LLM provider is selected, the chart deployed Ollama above —
  # pull the configured model into it now that the pods have settled.
  ensure_local_llm_model

  port_forward background
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

_PF_PIDS_FILE="/tmp/meridian-pf-pids"

# Echo a Service's LoadBalancer ingress address (IP or hostname), or nothing if
# it is not a LoadBalancer or has no external address assigned yet. (Only one of
# ip/hostname is ever set, so concatenating them yields just the address.)
lb_address() {
  kubectl get svc "$1" -n "$NAMESPACE" \
    -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}' \
    2>/dev/null
}

port_forward() {
  # mode: "background" (after install — return the shell prompt)
  #        "foreground" (standalone port-forward command — block until Ctrl+C)
  local mode="${1:-foreground}"

  # The frontends are LoadBalancer Services. When the cluster has assigned an
  # external IP, that is the address to use: kubectl port-forward drops
  # concurrent XHRs and makes the SPA look broken (status-0 on every /api call).
  # So we print the LB address when present and only port-forward a frontend
  # when it has NO external IP (e.g. kind / other bare clusters). The API
  # services are ClusterIP and are always port-forwarded for direct local access
  # (the SPAs reach them via the frontends' nginx /api proxy, so these forwards
  # are not needed just to load the UI).
  local portal_lb ops_lb
  portal_lb=$(lb_address public-portal)
  ops_lb=$(lb_address ops-dashboard)

  echo ""
  info "Access URLs:"
  if [[ -n "$portal_lb" ]]; then
    info "  Public Portal   → http://${portal_lb}"
  else
    info "  Public Portal   → http://localhost:8080  (port-forward)"
  fi
  if [[ -n "$ops_lb" ]]; then
    info "  Ops Dashboard   → http://${ops_lb}  (login: demo / dynatrace)"
  else
    info "  Ops Dashboard   → http://localhost:8081  (port-forward; login: demo / dynatrace)"
  fi
  info "  API Gateway     → http://localhost:3000  (port-forward)"
  info "  Demo Control    → http://localhost:3001  (port-forward)"
  if [[ -z "$portal_lb" || -z "$ops_lb" ]]; then
    info "Port-forwards restart automatically when pods are replaced."
  fi

  # Build the set of port-forwards to run: the ClusterIP API services always,
  # plus any frontend that lacks an external LoadBalancer IP.
  local -a targets=()
  [[ -z "$portal_lb" ]] && targets+=("svc/public-portal 8080:80")
  [[ -z "$ops_lb"    ]] && targets+=("svc/ops-dashboard 8081:80")
  targets+=("svc/api-gateway 3000:3000")
  targets+=("svc/demo-control-api 3001:3001")

  # Each port-forward runs inside a restart loop so that kubectl reconnects
  # after a pod is replaced (e.g. after 'rollout restart').  We bind to
  # 0.0.0.0 so ports are reachable from the host machine (required for kind
  # and remote setups — 127.0.0.1 only works when the browser is on the same
  # host as kubectl).
  local -a pf_loop_pids=()

  # _pf_loop <svc> <localPort:remotePort>
  # Runs kubectl port-forward in a tight restart loop; exits when killed.
  _pf_loop() {
    local svc=$1 ports=$2
    while true; do
      kubectl port-forward --address 0.0.0.0 "$svc" "$ports" -n "$NAMESPACE" &
      wait $! 2>/dev/null || true
      # Brief pause before retrying to avoid spin-looping when a pod is
      # temporarily unavailable (e.g. during a rollout restart).
      sleep 3
    done
  }

  local entry svc ports
  if [[ "$mode" == "background" ]]; then
    # Redirect stdio to /dev/null before disowning: without this the loops
    # inherit the terminal's file descriptors and kubectl's "Forwarding from..."
    # / "Handling connection for..." output bleeds onto the user's prompt after
    # the deploy script exits.
    for entry in "${targets[@]}"; do
      read -r svc ports <<< "$entry"
      _pf_loop "$svc" "$ports" </dev/null >/dev/null 2>&1 & pf_loop_pids+=($!)
    done
    # Save loop PIDs so teardown.sh can stop them cleanly, then detach
    # so the loops survive after this script exits.
    printf '%s\n' "${pf_loop_pids[@]}" > "$_PF_PIDS_FILE"
    disown "${pf_loop_pids[@]}" 2>/dev/null || true
    success "Port-forwards running in the background."
    info "  Stop forwards only: ./scripts/teardown.sh --pf   (full teardown: ./scripts/teardown.sh)"
  else
    # Foreground / interactive mode: keep kubectl output visible so the user
    # can see connection activity, then block until Ctrl+C.
    for entry in "${targets[@]}"; do
      read -r svc ports <<< "$entry"
      _pf_loop "$svc" "$ports" & pf_loop_pids+=($!)
    done
    info "Press Ctrl+C to stop."
    _stop_pf() {
      trap - EXIT INT TERM  # prevent re-entrant calls
      local pid
      for pid in "${pf_loop_pids[@]}"; do
        kill   "$pid"   2>/dev/null || true
        pkill -P "$pid" 2>/dev/null || true  # also kill the kubectl child
      done
      rm -f "$_PF_PIDS_FILE"
      echo
      info "Port-forwards stopped."
    }
    trap '_stop_pf' EXIT INT TERM
    wait
  fi
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
  seed)
    shift
    resolve_instance seed
    RELEASE_NAME="$RELEASE_NAME" NAMESPACE="$NAMESPACE" bash "${SCRIPT_DIR}/seed-data.sh" "$@"
    ;;
  status)
    resolve_instance status
    show_status
    ;;
  port-forward)
    resolve_instance port-forward
    port_forward
    ;;
  *)
    echo "Usage: $0 {repos|install|upgrade|seed|status|port-forward} [flags...]"
    echo ""
    echo "Multi-tenancy: 'install' generates a fresh per-instance hash (release"
    echo "meridian-<hash>, namespace meridian-<hash>). Pin or target an instance with"
    echo "RELEASE_NAME=meridian-<hash> (or INSTANCE_HASH=<hash>). upgrade/seed/status/"
    echo "port-forward auto-detect the sole instance, or take RELEASE_NAME to pick one."
    echo ""
    echo "Examples:"
    echo "  $0 repos"
    echo "  $0 install -f helm/values-custom.yaml                 # fresh random instance"
    echo "  INSTANCE_HASH=demo1 $0 install -f helm/values-custom.yaml"
    echo "  RELEASE_NAME=meridian-a1b2 $0 upgrade -f helm/values-custom.yaml"
    echo "  RELEASE_NAME=meridian-a1b2 $0 seed --reset"
    echo "  $0 status"
    echo "  $0 port-forward"
    exit 1
    ;;
esac
