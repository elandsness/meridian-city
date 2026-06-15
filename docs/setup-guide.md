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
- `cloudnative-pg` (PostgreSQL via the CloudNativePG operator)
- `strimzi` (Kafka via the Strimzi operator)
- `open-telemetry` (OTel Collector)
- `dynatrace` (Dynatrace Operator)

And runs `helm dependency update` to download chart archives into `helm/charts/`.

---

## Step 3: Create Your Values Override File

```bash
cp helm/values-custom.yaml.example helm/values-custom.yaml
```

> Copy the **example**, not `values.yaml`. `values-custom.yaml` overrides
> `values.yaml`, so copying the full default file silently pins stale values and
> causes hard-to-debug drift.

Edit `helm/values-custom.yaml` and set the following **required** values:

```yaml
# Your image registry (where CI pushed the images)
appImageRegistry: "ghcr.io/<org>/meridian-city"

dynatrace:
  # Your DT tenant API URL — find this in Dynatrace → Help → API
  apiUrl: "https://abc12345.live.dynatrace.com/api"

  # Your DT API token (created in Step 1 above)
  apiToken: "dt0c01.XXXXXX..."

  # OTLP ingest endpoint — replace the env ID
  otlpEndpoint: "https://abc12345.live.dynatrace.com/api/v2/otlp"

llm:
  provider: "openai"   # or "anthropic" or "local"
  openai:
    apiKey: "sk-..."   # Your OpenAI API key
```

`environmentId`, `deploymentEnvironment`, and `clusterName` are optional labels.

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
2. Deploy PostgreSQL (CloudNativePG) and Kafka (Strimzi)
3. Deploy the OTel Collector
4. Install the Dynatrace Operator as its own release in the `dynatrace` namespace
   and create the DynaKube CR there — only when `dynatrace.operator.enabled=true`
   **and** `dynatrace.apiUrl` is set
5. Deploy all 12 application services + the two frontends, IoT simulator, and traffic bot
6. **Seed demo data** and start **background port-forwards** automatically (Steps
   5–6 below are only needed to re-run those independently)

`deploy.sh` does not pass `helm --wait` (Java services crash-loop until the DB is
ready, which would deadlock the post-install hooks). It submits the release with
`--timeout 20m`, then runs `kubectl wait` for up to ~15 minutes. On first install,
Kafka takes 3–5 minutes to provision, so Kafka-dependent pods show `Init:0/1`
until it's ready — this is expected.

Once the DynaKube reaches `Running`, restart the app workloads once so OneAgent
injects them (deploy.sh prints this reminder):

```bash
kubectl -n meridian rollout restart deploy
```

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
- 5 city zones
- 15 smart buildings, 30 connected vehicles, 10 industrial machines (device ids
  match the IoT simulator: `bldg-000…`, `veh-000…`, `mach-000…`)
- 50 citizens
- 8 sample service requests and 4 sample incidents in various states

Run `./scripts/seed-data.sh --check` at any time to verify data counts.

---

## Step 7: Verify Dynatrace Observability

### OneAgent injection

```bash
kubectl describe pod -l app=citizen-service -n meridian | grep -A5 "Init Containers"
```

You should see an `install-oneagent` init container — confirms OneAgent is injecting.
The DynaKube uses `applicationMonitoring` (code-module injection via the CSI driver,
no host OneAgent — the host agent crash-loops on kind). Pods are only injected if
they (re)started **after** the DynaKube reached `Running`; if you don't see it, run
the `kubectl -n meridian rollout restart deploy` from Step 4.

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
./scripts/teardown.sh           # Full teardown (default): stops port-forwards, uninstalls
                                # the Helm release + Dynatrace Operator, deletes PVCs and the
                                # meridian/dynatrace namespaces (destroys all data)
./scripts/teardown.sh --soft    # Helm uninstall + stop port-forwards only; keeps namespaces
                                # and PVCs (for iterating on chart changes)
```

---

## Troubleshooting

### Pod stuck in `Init:0/1`

On first install the most common cause is **Kafka still provisioning** (3–5 min):
the Kafka-dependent Java services wait on a `wait-for-kafka` init container until
the broker is up. Give it a few minutes:
```bash
kubectl get pods -n meridian
kubectl get kafka -n meridian      # broker Ready?
```

If a pod stays in `Init` well after Kafka is ready, check OneAgent injection /
the DynaKube:
```bash
kubectl get pods -n dynatrace
kubectl describe dynakube meridian -n dynatrace        # look at Status / Conditions
```
A `dynatrace.apiToken` with insufficient scopes leaves the DynaKube in `Error`.
The operator token for `applicationMonitoring` needs more than ingest scopes —
e.g. `installerDownload`, `activeGateTokenManagement.create`, `entities.read`,
`settings.read`/`settings.write`, `DataExport`.

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
