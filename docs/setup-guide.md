# Meridian City Platform — Setup Guide

This guide walks through deploying the Meridian City Platform into a cloud-managed Kubernetes cluster from scratch. Follow every step in order.

---

## Prerequisites

### Tools

| Tool | Version | Install |
|---|---|---|
| `kubectl` | >= 1.26 | https://kubernetes.io/docs/tasks/tools/ |
| `helm` | >= 3.12 | https://helm.sh/docs/intro/install/ |
| `psql` | Any | For the seed data script (optional) |

### Kubernetes Cluster

- A cloud-managed k8s cluster: **EKS**, **AKS**, or **GKE** (or a local `kind` / Docker Desktop cluster for development)
- At least **3 nodes** with **4 vCPU / 8 GB RAM** total available
- `kubectl` configured and able to reach the cluster: `kubectl cluster-info`
- **Cluster admin permissions** (needed to create namespaces, RBAC, and the Dynatrace Operator)

### Dynatrace Tenant

- A Dynatrace SaaS tenant (free trial at https://dt-url.net/trial works fine)
- An **API token** with these scopes:
  - `metrics.ingest`
  - `logs.ingest`
  - `openTelemetryTrace.ingest`
  - `entities.read`
  - `settings.write`
  - `DataExport`

> To create an API token: **Dynatrace → Settings → Access Tokens → Generate new token**

---

## Step 1: Clone and Prepare

```bash
git clone https://github.com/elandsness/meridian-city.git
cd meridian-city

# Make scripts executable
chmod +x scripts/deploy.sh scripts/teardown.sh scripts/seed-data.sh
```

---

## Step 2: Add Helm Repositories and Resolve Dependencies

```bash
./scripts/deploy.sh repos
```

This adds:
- `bitnami` (PostgreSQL, Kafka)
- `open-telemetry` (OTel Collector)
- `dynatrace` (Dynatrace Operator)

And runs `helm dependency update` to download chart archives into `helm/charts/`.

---

## Step 3: Create Your Values Override File

```bash
cp helm/values.yaml helm/values-custom.yaml
```

Edit `helm/values-custom.yaml` and set the following **required** values:

```yaml
dynatrace:
  # Your DT tenant API URL — find this in Dynatrace → Help → API
  apiUrl: "https://abc12345.live.dynatrace.com/api"

  # Your DT API token (created in Step 1 above)
  apiToken: "dt0c01.XXXXXX..."

  # OTLP ingest endpoint — replace the env ID
  otlpEndpoint: "https://abc12345.live.dynatrace.com/api/v2/otlp"

  # Your environment ID (the subdomain, e.g., "abc12345")
  environmentId: "abc12345"

llm:
  provider: "openai"   # or "anthropic" or "local"
  openai:
    apiKey: "sk-..."   # Your OpenAI API key
```

### Optional but recommended overrides:

```yaml
global:
  # Tag matching your current image build (or "latest" for the first deploy)
  imageTag: "latest"

# Enable ingress if you have an ingress controller
apiGateway:
  ingress:
    enabled: true
    className: "nginx"
    host: "api.your-domain.com"
```

---

## Step 4: Install

```bash
./scripts/deploy.sh install -f helm/values-custom.yaml
```

For local development (smaller resources, no DT Operator):

```bash
./scripts/deploy.sh install \
  -f helm/values-custom.yaml \
  -f helm/values-dev.yaml
```

This will:
1. Create the `meridian` and `dynatrace` namespaces
2. Deploy PostgreSQL and Kafka (Bitnami charts)
3. Deploy the OTel Collector
4. Deploy the Dynatrace Operator and create the DynaKube CR (if `dynatrace.operator.enabled=true`)
5. Deploy all 12 application services
6. Deploy the two frontend apps, IoT simulator, and traffic bot

The `--wait` flag waits up to 10 minutes for all pods to reach Ready state.

---

## Step 5: Validate

### Check all pods are running

```bash
kubectl get pods -n meridian
```

Expected output: all pods `Running` with `1/1` or `2/2` Ready (the `2/2` means OneAgent injected).

### Verify the API gateway responds

```bash
kubectl port-forward svc/api-gateway 3000:3000 -n meridian
curl http://localhost:3000/health
# Expected: {"status":"ok","services":{...}}
```

### Access the UIs

```bash
./scripts/deploy.sh port-forward
```

Then open:
- **Public Portal**: http://localhost:8080
- **Ops Dashboard**: http://localhost:8081 (login: `demo` / `dynatrace`)

---

## Step 6: Seed Demo Data

```bash
./scripts/seed-data.sh
```

This populates:
- 15 smart buildings, 30 connected vehicles, 10 industrial machines
- 50 citizen accounts
- 8 sample service requests in various states

Run `./scripts/seed-data.sh --check` at any time to verify data counts.

---

## Step 7: Verify Dynatrace Observability

### OneAgent injection

```bash
kubectl describe pod -l app=citizen-service -n meridian | grep -A5 "Init Containers"
```

You should see `install-oneagent-sdk` or similar init container — confirms OneAgent is injecting.

### Services visible in Dynatrace

In Dynatrace: **Observe and Explore → Services**

After 2-3 minutes of traffic from the traffic bot, you should see:
- `citizen-service`
- `service-dispatch`
- `city-operations`
- `api-gateway`
- `ai-service`
- `analytics-service`
- `notification-service`
- `iot-ingestion`
- `telemetry-processor`

### OTel metrics from IoT

In Dynatrace: **Observe and Explore → Metrics**
Search for: `iot.device.`

You should see metrics like `iot.device.vehicle.engine_temp`, `iot.device.building.hvac_temp`, etc.

### AI Observability

Make a request to the chatbot:
```bash
curl -X POST http://localhost:3000/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What services does the city offer?"}'
```

In Dynatrace: **AI Observability** — look for spans with `gen_ai.system` attribute.

---

## Step 8: Configure Dynatrace Tenant (Manual)

See [dynatrace-config-guide.md](dynatrace-config-guide.md) for:
- Business Events configuration for all three business flows
- Site Reliability Guardian SLO definitions
- Dashboard setup

---

## Continuous Integration (Image Builds)

Service images are built and pushed to GHCR by `.github/workflows/build.yml` on
every push to `main`. The workflow logs in to Docker Hub before building so that
base-image pulls (`eclipse-temurin`, `maven`, `node`, `python`, `golang`) are
authenticated.

> **Why:** Docker Hub rate-limits *anonymous* pulls per source IP over a rolling
> ~6-hour window. Once a day's builds exhaust it, the next pull fails with a
> misleading `401 UNAUTHORIZED` / `authentication required` on
> `docker.io/library/*` and the image build step fails — even though the Maven /
> npm compile step succeeded. Authenticating raises the limit substantially.

Set these as repository **Actions secrets** (*repo → Settings → Secrets and
variables → Actions*):

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | A Docker Hub **access token** (*Account Settings → Security → New Access Token*) — not your password |

If the secrets are absent the login step is skipped and the build falls back to
anonymous pulls (so it never hard-fails on a missing secret — it just remains
subject to the rate limit). These are separate from the optional **cluster-side**
Docker Hub credentials in `helm/values-custom.yaml.example` (`dockerhub:`), which
only matter if your cluster itself pulls Docker Hub images and hits the same limit.

---

## Upgrading

After building new images (CI pushes to GHCR):

```bash
./scripts/deploy.sh upgrade -f helm/values-custom.yaml --set global.imageTag=<git-sha>
```

---

## Teardown

```bash
./scripts/teardown.sh           # Remove the Helm release
./scripts/teardown.sh --all     # Also delete namespaces (destroys all data)
```

---

## Troubleshooting

### Pod stuck in `Init:0/1`

The Dynatrace Operator's OneAgent init container is waiting. Check operator is running:
```bash
kubectl get pods -n dynatrace
kubectl describe pod -l app=citizen-service -n meridian
```

If the DynaKube CR is not yet ready, the init container will wait (and eventually timeout). Fix:
```bash
kubectl describe dynakube meridian -n dynatrace
```

Common cause: `dynatrace.apiToken` is wrong or has insufficient scopes.

### PostgreSQL not ready

Java services (Spring Boot) will crash-loop until PostgreSQL is healthy. This is expected during first install — they will recover automatically once PostgreSQL is up (usually within 2-3 minutes).

### Kafka consumer lag

`telemetry-processor` needs Kafka to be fully started. On first install with large IoT fleets, there may be lag. Monitor:
```bash
kubectl logs -l app=telemetry-processor -n meridian --tail=50 -f
```

### LLM API errors

Check ai-service logs:
```bash
kubectl logs -l app=ai-service -n meridian --tail=50
```

Common causes:
- `OPENAI_API_KEY` not set or invalid
- Rate limit hit (reduce traffic bot's `SCENARIO_CHATBOT=false`)
- Wrong `llm.provider` value (must be `openai`, `anthropic`, or `local`)

### CI build fails with `401 UNAUTHORIZED` on a `docker.io/library/*` pull

This is Docker Hub's *anonymous* pull rate limit (it reports as `authentication
required`, not `429`), not a real auth failure — the build's `mvn` / `npm` step
succeeds and only the Docker image build fails. Authenticate the CI build by
setting the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` Actions secrets (see
[Continuous Integration (Image Builds)](#continuous-integration-image-builds)).
A bare re-run may pass once the window resets, but it recurs until the secrets
are in place.

### Helm dependency error

```bash
helm dependency update helm/
```

If a chart version is not found, check the repository URL is correct and the version exists:
```bash
helm search repo bitnami/postgresql --versions | head -10
```

Then update `helm/Chart.yaml` to a version that exists.
