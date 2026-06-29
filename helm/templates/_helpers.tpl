{{/*
Expand the name of the chart.
*/}}
{{- define "meridian.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name. This is the PER-INSTANCE identity used
to name every instance-scoped resource (Kafka/Postgres clusters, Secrets, the
DynaKube, etc.). It is the Helm release name, which scripts/deploy.sh sets to
`meridian-<hash>` (e.g. meridian-a1b2) so two concurrent installs never collide.
*/}}
{{- define "meridian.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
The short per-instance hash (e.g. "a1b2"). Single source of truth, fanned out to
the Dynatrace identity (deployment.environment suffix etc.).
Precedence: explicit global.instanceHash value > the suffix of a `meridian-<hash>`
release name > "" (legacy single-instance install named exactly "meridian").
*/}}
{{- define "meridian.instanceHash" -}}
{{- if .Values.global.instanceHash -}}
{{- .Values.global.instanceHash -}}
{{- else if hasPrefix "meridian-" .Release.Name -}}
{{- trimPrefix "meridian-" .Release.Name -}}
{{- end -}}
{{- end }}

{{/*
Common labels applied to all resources. `part-of` is the platform-family label
(NOT an instance identity) — it is namespace-scoped here and drives deploy.sh's
rollout-restart selector, so it stays constant across instances.
app.kubernetes.io/instance carries the per-instance release name.
*/}}
{{- define "meridian.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/part-of: meridian-city-platform
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Values.global.imageTag | quote }}
{{- end }}

{{/*
Selector labels for a given component.
Usage: include "meridian.selectorLabels" (dict "component" "citizen-service" "context" $)
*/}}
{{- define "meridian.selectorLabels" -}}
app.kubernetes.io/name: {{ .component }}
app.kubernetes.io/instance: {{ .context.Release.Name }}
{{- end }}

{{/*
Construct the full image reference for a service.
Usage: include "meridian.image" (dict "repository" .Values.citizenService.image.repository "tag" .Values.citizenService.image.tag "context" $)
*/}}
{{- define "meridian.image" -}}
{{- $registry := .context.Values.appImageRegistry -}}
{{- $tag := .tag | default .context.Values.global.imageTag -}}
{{- printf "%s/%s:%s" $registry .repository $tag -}}
{{- end }}

{{/*
Namespace — all instance-scoped app resources go into the release namespace
(scripts/deploy.sh creates `meridian-<hash>` and installs into it). Falls back to
.Release.Namespace so there is a single source of truth: the `helm -n` flag.
global.namespace stays available as an explicit override.
*/}}
{{- define "meridian.namespace" -}}
{{- .Values.global.namespace | default .Release.Namespace -}}
{{- end }}

{{/* ----------------------------------------------------------------------- */}}
{{/* Per-instance infrastructure resource names. Derived from meridian.fullname */}}
{{/* (= meridian-<hash>) so two concurrent installs never share a name, and the  */}}
{{/* operator-generated DNS (Strimzi bootstrap, CNPG -rw service) is unique too. */}}
{{/* ----------------------------------------------------------------------- */}}

{{/* Strimzi Kafka cluster CR name. */}}
{{- define "meridian.kafkaCluster" -}}
{{- include "meridian.fullname" . -}}
{{- end }}

{{/* Strimzi bootstrap Service DNS name (<cluster>-kafka-bootstrap). */}}
{{- define "meridian.kafkaBootstrap" -}}
{{- printf "%s-kafka-bootstrap" (include "meridian.fullname" .) -}}
{{- end }}

{{/* CloudNativePG Cluster CR name. */}}
{{- define "meridian.dbCluster" -}}
{{- printf "%s-db" (include "meridian.fullname" .) -}}
{{- end }}

{{/* CloudNativePG read-write Service DNS name (<cluster>-rw). */}}
{{- define "meridian.dbRwService" -}}
{{- printf "%s-db-rw" (include "meridian.fullname" .) -}}
{{- end }}

{{/* CloudNativePG bootstrap credentials Secret name. */}}
{{- define "meridian.dbCredentialsSecret" -}}
{{- printf "%s-db-credentials" (include "meridian.fullname" .) -}}
{{- end }}

{{/* Shared application Secret (db/auth/llm passwords). */}}
{{- define "meridian.appSecret" -}}
{{- printf "%s-secrets" (include "meridian.fullname" .) -}}
{{- end }}

{{/* Dynatrace API token Secret. Lives in the SHARED `dynatrace` namespace, so it
     MUST be per-instance to avoid clobbering another instance's token. */}}
{{- define "meridian.dynatraceTokensSecret" -}}
{{- printf "%s-dynatrace-tokens" (include "meridian.fullname" .) -}}
{{- end }}

{{/* ----------------------------------------------------------------------- */}}
{{/* Per-instance Dynatrace OBSERVABILITY identity. These are what make the two */}}
{{/* instances distinguishable on the SHARED tenant. Each derives from the      */}}
{{/* release name / hash but stays overridable via values.                      */}}
{{/* ----------------------------------------------------------------------- */}}

{{/* k8s.cluster.name reported to Dynatrace (default: <release>-cluster). */}}
{{- define "meridian.dynatrace.clusterName" -}}
{{- .Values.dynatrace.clusterName | default (printf "%s-cluster" (include "meridian.fullname" .)) -}}
{{- end }}

{{/* deployment.environment reported to Dynatrace. The hash is suffixed so every
     instance gets a unique environment dimension (e.g. demo-a1b2). */}}
{{- define "meridian.dynatrace.deploymentEnvironment" -}}
{{- $env := .Values.dynatrace.deploymentEnvironment | default "demo" -}}
{{- $hash := include "meridian.instanceHash" . -}}
{{- if $hash -}}{{ printf "%s-%s" $env $hash }}{{- else -}}{{ $env }}{{- end -}}
{{- end }}

{{/* bizevent provider stamped on every extracted business event
     (default: <release>.city, e.g. meridian-a1b2.city). */}}
{{- define "meridian.dynatrace.eventProvider" -}}
{{- .Values.dynatrace.businessConfig.eventProvider | default (printf "%s.city" (include "meridian.fullname" .)) -}}
{{- end }}

{{/*
Common environment variables injected into every application service.
Provides OTel service name, OTLP exporter endpoint, and DB/Kafka coordinates.
All identity coordinates are per-instance (see helpers above).
*/}}
{{- define "meridian.commonEnv" -}}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: "http://{{ include "meridian.fullname" .context }}-opentelemetry-collector:4318"
- name: OTEL_RESOURCE_ATTRIBUTES
  value: "deployment.environment={{ include "meridian.dynatrace.deploymentEnvironment" .context }},k8s.cluster.name={{ include "meridian.dynatrace.clusterName" .context }},service.namespace={{ include "meridian.namespace" .context }}"
- name: KAFKA_BOOTSTRAP_SERVERS
  value: "{{ include "meridian.kafkaBootstrap" .context }}:9092"
- name: DB_HOST
  value: "{{ include "meridian.dbRwService" .context }}"
- name: DB_PORT
  value: "5432"
- name: DB_NAME
  value: {{ .context.Values.postgresql.auth.database | quote }}
- name: DB_USER
  value: {{ .context.Values.postgresql.auth.username | quote }}
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "meridian.appSecret" .context }}
      key: db-password
{{- end }}

{{/*
Render a service's optional extra env map (.Values.<svc>.env) as container env entries.
Lets operators tune per-service knobs (e.g. the lifecycle delay bands) from values.yaml
without editing templates. Usage (after the commonEnv include):
  {{- include "meridian.extraEnv" .Values.citizenService.env | nindent 12 }}
*/}}
{{- define "meridian.extraEnv" -}}
{{- range $k, $v := . }}
- name: {{ $k }}
  value: {{ $v | quote }}
{{- end }}
{{- end }}

{{/*
Init container that blocks until the Strimzi Kafka bootstrap service is
reachable.  Without this, Java services that hard-fail on missing Kafka DNS
(consumers, KafkaAdmin) enter CrashLoopBackOff for the 3-5 minutes it takes
Strimzi to provision the Kafka broker on a fresh install.

Usage (inside a pod spec, before containers:):
  initContainers:
    {{- include "meridian.kafkaWaitInitContainer" . | nindent 8 }}
*/}}
{{- define "meridian.kafkaWaitInitContainer" -}}
{{- $bootstrap := include "meridian.kafkaBootstrap" . -}}
- name: wait-for-kafka
  image: busybox:1.36
  command:
    - sh
    - -c
    - |
      until nc -z {{ $bootstrap }} 9092; do
        echo "Waiting for Kafka bootstrap ({{ $bootstrap }}:9092)...";
        sleep 3;
      done
      echo "Kafka ready."
{{- end }}
