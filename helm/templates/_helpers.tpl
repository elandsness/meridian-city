{{/*
Expand the name of the chart.
*/}}
{{- define "meridian.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "meridian.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/*
Common labels applied to all resources.
*/}}
{{- define "meridian.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/part-of: meridian-city-platform
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
Common environment variables injected into every application service.
Provides OTel service name, OTLP exporter endpoint, and DB/Kafka coordinates.
*/}}
{{- define "meridian.commonEnv" -}}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: "http://{{ include "meridian.fullname" .context }}-opentelemetry-collector:4318"
- name: OTEL_RESOURCE_ATTRIBUTES
  value: "deployment.environment={{ .context.Values.dynatrace.deploymentEnvironment }},k8s.cluster.name={{ .context.Values.dynatrace.clusterName }}"
- name: KAFKA_BOOTSTRAP_SERVERS
  value: "meridian-kafka-bootstrap:9092"
- name: DB_HOST
  value: "meridian-db-rw"
- name: DB_PORT
  value: "5432"
- name: DB_NAME
  value: {{ .context.Values.postgresql.auth.database | quote }}
- name: DB_USER
  value: {{ .context.Values.postgresql.auth.username | quote }}
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: meridian-secrets
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
Namespace — all app resources go into the configured namespace.
*/}}
{{- define "meridian.namespace" -}}
{{ .Values.global.namespace }}
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
- name: wait-for-kafka
  image: busybox:1.36
  command:
    - sh
    - -c
    - |
      until nc -z meridian-kafka-bootstrap 9092; do
        echo "Waiting for Kafka bootstrap (meridian-kafka-bootstrap:9092)...";
        sleep 3;
      done
      echo "Kafka ready."
{{- end }}
