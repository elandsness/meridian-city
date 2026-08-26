# EKS Compatibility Branch — Summary

## What Was Done

I've completed the EKS compatibility work for the Meridian City Helm chart. The changes are **additive and non-destructive** — they work on both EKS and GKE AutoPilot without breaking existing deployments.

## Changes Summary

### Files Modified (3 files, +62 lines)

1. **`helm/values.yaml`** (+56 lines)
   - Added `storageClassName` field to PostgreSQL and Kafka storage configs
   - Added comprehensive EKS deployment notes with storage class examples
   - Added node affinity examples for EKS production deployments

2. **`helm/templates/kafka-cluster.yaml`** (+3 lines)
   - Added conditional storage class rendering for Kafka

3. **`helm/templates/postgresql-cluster.yaml`** (+3 lines)
   - Added conditional storage class rendering for PostgreSQL (from earlier work)

### Files Created (2 files)

4. **`docs/eks-deployment-guide.md`** — Comprehensive EKS deployment guide
   - Prerequisites (EBS CSI driver, storage classes, node groups)
   - Step-by-step deployment instructions
   - Troubleshooting section
   - EKS best practices

5. **`docs/eks-compatibility-summary.md`** — Detailed technical summary
   - What changed and why
   - Backward compatibility notes
   - Testing instructions
   - References to AWS documentation

## Why These Changes?

### The Problem

Your colleague's EKS deployment was likely failing because:

1. **No explicit storage class** — EKS default is `gp2` (legacy), which may not be optimal
2. **Missing EBS CSI driver** — EKS doesn't include it by default; must be installed separately
3. **No AZ affinity** — Without `WaitForFirstConsumer`, volumes may be in different AZs than pods
4. **No node group guidance** — Stateful workloads need dedicated nodes with right instance types

### The Solution

1. **Explicit storage class configuration** — Allows specifying `gp3` (best value) or `io2` (low-latency)
2. **Documentation** — Clear instructions for EBS CSI driver and storage class setup
3. **WaitForFirstConsumer** — Ensures volumes and pods are in same AZ
4. **Node affinity examples** — Shows how to schedule on appropriate instance types

## How to Test on EKS

### Quick Test

```bash
# 1. Install EBS CSI driver (if not already done)
# Follow: https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html

# 2. Create storage class
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
parameters:
  type: gp3
  encrypted: "true"
EOF

# 3. Deploy Meridian City
./scripts/deploy.sh install \
  --set postgresql.storage.storageClassName=gp3 \
  --set kafka.storage.storageClassName=gp3

# 4. Verify
./scripts/deploy.sh status
kubectl get pvc -n meridian-<hash>
```

### Expected Behavior

- ✅ Kafka and PostgreSQL pods become `Running` and `Ready`
- ✅ PVCs are in `Bound` state
- ✅ No `Pending` pods waiting for volumes

## Backward Compatibility

**100% backward compatible:**
- `storageClassName: ""` (empty) means "use cluster default"
- On GKE AutoPilot: uses `standard` or `premium-ssd`
- On kind/minikube: uses whatever default exists
- **No breaking changes** to existing deployments

## Key Documentation References

### AWS Documentation
- [EBS CSI Driver on EKS](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
- [Storage Classes](https://docs.aws.amazon.com/eks/latest/userguide/storage-classes.html)
- [EKS Best Practices](https://docs.aws.amazon.com/eks/latest/userguide/eks-best-practices.html)

### Strimzi (Kafka)
- [Strimzi on EKS](https://strimzi.io/docs/operators/latest/deploying/)
- [KafkaNodePool Storage](https://strimzi.io/docs/operators/latest/full/deploying.html#_kafkanodepool_spec_storage)

### CloudNativePG (PostgreSQL)
- [CloudNativePG on EKS](https://cloudnative-pg.io/documentation/current/installation/)
- [Storage Configuration](https://cloudnative-pg.io/documentation/current/persistent_storage/)

## Troubleshooting

### Pods Stuck in Pending?

**Most likely cause**: Missing EBS CSI driver.

**Check**:
```bash
# Verify EBS CSI driver is running
kubectl get pods -n kube-system | grep ebs-csi

# Check PVC status
kubectl describe pvc -n meridian-<hash>

# Look for errors like:
# "no persistent volume available" → EBS CSI driver not installed
# "storageclass "gp3" not found" → Storage class not created
```

### Kafka Not Starting?

**Check**:
```bash
# Verify Strimzi operator
kubectl get pods -n strimzi-system

# Check Kafka CR
kubectl describe kafka -n meridian-<hash>

# Check Strimzi operator logs
kubectl logs -n strimzi-system -l app=strimzi-kafka-operator
```

## Next Steps

1. **Have your colleague test on EKS** using the quick test above
2. **Monitor pod status** with `./scripts/deploy.sh status`
3. **Verify PVCs are bound** with `kubectl get pvc -n meridian-<hash>`
4. **Report back** with results or any issues encountered

## Files to Review

- **`docs/eks-deployment-guide.md`** — Full EKS deployment guide (read this first)
- **`docs/eks-compatibility-summary.md`** — Detailed technical summary
- **`helm/values.yaml`** — See EKS notes in comments
- **`helm/templates/kafka-cluster.yaml`** — Storage class support
- **`helm/templates/postgresql-cluster.yaml`** — Storage class support

## Git Status

```
On branch: fix/aws-eks-compatibility

Modified:
  helm/templates/kafka-cluster.yaml
  helm/templates/postgresql-cluster.yaml
  helm/values.yaml

Created:
  docs/eks-compatibility-summary.md
  docs/eks-deployment-guide.md
```

## Ready to Test

The branch is ready for your colleague to test on EKS. The changes are minimal, well-documented, and backward-compatible. If any issues arise, the troubleshooting section in `docs/eks-deployment-guide.md` should help resolve them.