# Meridian City on AWS EKS — Deployment Guide

This guide covers deploying Meridian City on Amazon EKS (Elastic Kubernetes Service). The platform **auto-configures** storage classes for EKS, GKE, and AKS — it should "just work" on all three platforms.

## Quick Start (EKS)

### 1. Prerequisites

**EBS CSI Driver** — EKS requires this for persistent volumes. The chart will fail if it's not installed:

```bash
# Check if EBS CSI driver is installed
kubectl get pods -n kube-system | grep ebs-csi

# If missing, install it:
# https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html
```

### 2. Deploy (No Storage Class Configuration Needed!)

The chart auto-detects EKS and creates `meridian-gp3` (default) and `meridian-io2` storage classes:

```bash
./scripts/deploy.sh repos
./scripts/deploy.sh install
```

That's it! The chart handles everything automatically.

### 3. Verify

```bash
./scripts/deploy.sh status
kubectl get pvc -n meridian-<hash>
kubectl get sc | grep meridian
```

## How Auto-Configuration Works

The chart includes a **pre-install Helm hook** (`storage-class-job.yaml`) that:

1. **Detects the cloud provider** by checking node labels:
   - **AWS (EKS)**: Checks for `topology.kubernetes.io/zone` with AWS format
   - **GCP (GKE)**: Checks for `cloud.google.com/gke-nodepool` label
   - **Azure (AKS)**: Checks for Azure-specific zone labels

2. **Creates storage classes** appropriate for the provider:

   | Provider | Default Storage Class | Alternative |
   |----------|----------------------|-------------|
   | AWS (EKS) | `meridian-gp3` | `meridian-io2` |
   | GCP (GKE) | `meridian-standard` | `meridian-premium` |
   | Azure (AKS) | `meridian-managed-premium` | `meridian-managed-ssd` |

3. **Sets the default** — The primary storage class is marked as `is-default-class: "true"`

### Storage Class Details

**AWS (EKS)**:
- `meridian-gp3`: General purpose, best value (~$0.125/GiB/mo)
- `meridian-io2`: Low-latency, high-IOPS (~$0.65/GiB/mo)

**GCP (GKE)**:
- `meridian-standard`: Standard persistent disk (pd-standard)
- `meridian-premium`: SSD persistent disk (pd-ssd)

**Azure (AKS)**:
- `meridian-managed-premium`: Standard SSD managed disk
- `meridian-managed-ssd`: Premium SSD managed disk

All storage classes use:
- `WaitForFirstConsumer` for AZ affinity
- `Retain` reclaim policy for data safety
- Encryption enabled

## Override Storage Class (Optional)

If you want to use a specific storage class or cluster default:

```bash
# Use a custom storage class
./scripts/deploy.sh install \
  --set postgresql.storage.storageClassName=custom-sc \
  --set kafka.storage.storageClassName=custom-sc

# Use cluster default (leave empty)
./scripts/deploy.sh install \
  --set postgresql.storage.storageClassName="" \
  --set kafka.storage.storageClassName=""
```

## Troubleshooting

### Pods Stuck in Pending State

**Most likely cause**: Missing CSI driver for your cloud provider.

```bash
# Check which CSI driver is needed:
# AWS: ebs-csi-driver
# GCP: gcp-compute-persistent-disk-csi-driver
# Azure: disk-csi-driver

# Check if driver is running:
kubectl get pods -n kube-system | grep -E 'ebs-csi|gcp|disk-csi'

# Check PVC status:
kubectl describe pvc -n meridian-<hash>
```

### Storage Class Creation Failed

**Check the hook Job logs**:

```bash
# Find the storage class setup job
kubectl get jobs -n meridian-<hash> | grep storage

# Check logs
kubectl logs -n meridian-<hash> <job-name>
```

**Common issues**:
- CSI driver not installed (see above)
- Insufficient RBAC permissions (the Job uses a ServiceAccount with ClusterRole)
- Network policies blocking kubectl API access

### Kafka or PostgreSQL Not Starting

**Check the operators**:

```bash
# Strimzi (Kafka)
kubectl get pods -n strimzi-system
kubectl describe kafka -n meridian-<hash>

# CloudNativePG (PostgreSQL)
kubectl get pods -n cnpg-system
kubectl describe cluster -n meridian-<hash>
```

## Cross-Cloud Deployment

### GKE (Google Kubernetes Engine)

The chart auto-detects GKE and creates `meridian-standard` (default) and `meridian-premium`:

```bash
./scripts/deploy.sh install
```

**Note**: GKE includes the CSI driver by default, so no manual setup needed.

### AKS (Azure Kubernetes Service)

The chart auto-detects AKS and creates `meridian-managed-premium` (default) and `meridian-managed-ssd`:

```bash
./scripts/deploy.sh install
```

**Note**: AKS includes the CSI driver by default, so no manual setup needed.

### kind / Minikube (Local Development)

For local development, leave storage class empty to use the cluster default:

```bash
./scripts/deploy.sh install \
  --set postgresql.storage.storageClassName="" \
  --set kafka.storage.storageClassName=""
```

## EKS Best Practices Applied

This Helm chart follows these cloud-agnostic best practices:

1. **Auto-detected storage classes** — No manual configuration needed
2. **WaitForFirstConsumer** — AZ affinity for volumes and pods
3. **Encryption** — Volumes encrypted with cloud provider KMS
4. **Retain Reclaim Policy** — Data preserved across PVC deletion
5. **Right-sized instances** — Memory-optimized for stateful workloads
6. **Idempotent hooks** — Safe to re-run storage class setup

## References

- [EBS CSI Driver on EKS](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
- [GKE Storage](https://cloud.google.com/kubernetes-engine/docs/concepts/persistent-storage)
- [AKS Storage](https://learn.microsoft.com/en-us/azure/aks/concepts-storage)
- [Strimzi on EKS](https://strimzi.io/docs/operators/latest/deploying/)
- [CloudNativePG on EKS](https://cloudnative-pg.io/documentation/current/installation/)

## Support

For issues, check:
1. CSI driver installation (EKS requires manual setup)
2. Storage class creation logs (`kubectl logs` on the storage-class-setup Job)
3. PVC status (`kubectl describe pvc`)
4. Operator status (Strimzi, CNPG)

If you encounter issues not covered here, please open an issue on GitHub.