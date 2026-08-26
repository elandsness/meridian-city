# Meridian City — Cross-Cloud Deployment Guide

Meridian City supports **AWS EKS**, **GCP GKE**, and **Azure AKS** with automatic storage class configuration. The chart detects your cloud provider and creates appropriate storage classes — it should "just work" on all three platforms.

## Quick Start by Cloud Provider

### AWS EKS

```bash
# 1. Ensure EBS CSI driver is installed (required for EKS)
# https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html

# 2. Deploy (auto-creates meridian-gp3 storage class)
./scripts/deploy.sh repos
./scripts/deploy.sh install

# 3. Verify
./scripts/deploy.sh status
kubectl get sc | grep meridian
```

**Auto-created storage classes**:
- `meridian-gp3` (default) — General purpose, best value
- `meridian-io2` — Low-latency, high-IOPS

### GCP GKE

```bash
# GKE includes CSI driver by default — no setup needed

# Deploy (auto-creates meridian-standard storage class)
./scripts/deploy.sh repos
./scripts/deploy.sh install

# Verify
./scripts/deploy.sh status
kubectl get sc | grep meridian
```

**Auto-created storage classes**:
- `meridian-standard` (default) — Standard persistent disk
- `meridian-premium` — SSD persistent disk

### Azure AKS

```bash
# AKS includes CSI driver by default — no setup needed

# Deploy (auto-creates meridian-managed-premium storage class)
./scripts/deploy.sh repos
./scripts/deploy.sh install

# Verify
./scripts/deploy.sh status
kubectl get sc | grep meridian
```

**Auto-created storage classes**:
- `meridian-managed-premium` (default) — Standard SSD managed disk
- `meridian-managed-ssd` — Premium SSD managed disk

## How Auto-Detection Works

The chart includes a **pre-install Helm hook** (`storage-class-job.yaml`) that:

1. **Detects the cloud provider** by checking node labels
2. **Creates storage classes** appropriate for the provider
3. **Sets the default** storage class

### Detection Logic

```bash
# Check for GCP (GKE)
if kubectl get nodes -o jsonpath='{.items[0].metadata.labels.cloud\.google\.com/gke-nodepool}' | grep -q .; then
  PROVIDER="gcp"

# Check for Azure (AKS)
elif kubectl get nodes -o jsonpath='{.items[0].metadata.labels.failure-domain\.beta\.kubernetes\.io/zone}' | grep -q . || \
     kubectl get nodes -o jsonpath='{.items[0].metadata.labels.kubernetes\.io/azure-zone}' | grep -q .; then
  PROVIDER="azure"

# Default to AWS (EKS)
else
  PROVIDER="aws"
fi
```

### Storage Class Details

| Provider | Default | Alternative | Provisioner | Volume Type |
|----------|---------|-------------|-------------|-------------|
| **AWS** | `meridian-gp3` | `meridian-io2` | `ebs.csi.aws.com` | EBS (gp3/io2) |
| **GCP** | `meridian-standard` | `meridian-premium` | `pd.csi.storage.gke.io` | Persistent Disk |
| **Azure** | `meridian-managed-premium` | `meridian-managed-ssd` | `disk.csi.azure.com` | Managed Disk |

**All storage classes use**:
- `WaitForFirstConsumer` — AZ affinity for volumes and pods
- `Retain` reclaim policy — Data preserved across PVC deletion
- Encryption enabled — Using cloud provider KMS

## Override Storage Class

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

## Local Development (kind / Minikube)

For local development, leave storage class empty to use the cluster default:

```bash
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
- CSI driver not installed (EKS requires manual setup)
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

## Cloud-Specific Considerations

### AWS EKS

- **EBS CSI driver required** — Not included by default
- **Instance types**: Use `r6i` (memory-optimized) or `i3en` (high I/O) for stateful workloads
- **Node groups**: Consider dedicated node groups for Kafka/PostgreSQL
- **IAM**: Ensure EBS CSI driver has proper IAM permissions

### GCP GKE

- **CSI driver included** — No manual setup needed
- **Node pools**: Use `n2` or `e2` series for general workloads
- **Zones**: Choose zones with sufficient storage capacity
- **Cost**: Standard persistent disks are cost-effective

### Azure AKS

- **CSI driver included** — No manual setup needed
- **VM sizes**: Use `E-series` (memory-optimized) for stateful workloads
- **Availability zones**: Deploy across multiple AZs for HA
- **Managed disks**: Premium SSD for low-latency workloads

## Best Practices

1. **Use dedicated node groups** for stateful workloads (Kafka, PostgreSQL)
2. **Enable encryption** — All auto-created storage classes are encrypted
3. **Monitor storage costs** — Use `Retain` reclaim policy to avoid data loss
4. **Test upgrades** — Verify storage class compatibility before production upgrades
5. **Backup strategy** — Use cloud provider backup solutions (AWS Backup, GCP Backup, Azure Backup)

## References

- [AWS EKS Storage](https://docs.aws.amazon.com/eks/latest/userguide/storage-classes.html)
- [GCP GKE Storage](https://cloud.google.com/kubernetes-engine/docs/concepts/persistent-storage)
- [Azure AKS Storage](https://learn.microsoft.com/en-us/azure/aks/concepts-storage)
- [Strimzi on EKS](https://strimzi.io/docs/operators/latest/deploying/)
- [CloudNativePG on EKS](https://cloudnative-pg.io/documentation/current/installation/)

## Support

For issues, check:
1. CSI driver installation (EKS requires manual setup)
2. Storage class creation logs (`kubectl logs` on the storage-class-setup Job)
3. PVC status (`kubectl describe pvc`)
4. Operator status (Strimzi, CNPG)

If you encounter issues not covered here, please open an issue on GitHub.