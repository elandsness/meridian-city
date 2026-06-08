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
{{- $registry := .context.Values.global.appImageRegistry -}}
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
  value: "{{ include "meridian.fullname" .context }}-kafka:9092"
- name: DB_HOST
  value: "{{ include "meridian.fullname" .context }}-postgresql"
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
Namespace — all app resources go into the configured namespace.
*/}}
{{- define "meridian.namespace" -}}
{{ .Values.global.namespace }}
{{- end }}
