# EKS Compatibility Changes — Summary

## Overview

This branch adds AWS EKS compatibility to the Meridian City Helm chart in an **additive, non-destructive** way. The changes:
- Add explicit storage class configuration for Kafka and PostgreSQL
- Provide EKS-specific documentation and best practices
- Include node affinity examples for EKS production deployments
- **Do not break existing GKE AutoPilot deployments** (backward compatible)

## Changes Made

### 1. Helm Values (`helm/values.yaml`)

**Added storage class configuration:**
```yaml
postgresql:
  storage:
    size: "10Gi"
    storageClassName: ""  # NEW: Empty = cluster default

kafka:
  storage:
    size: "8Gi"
    storageClassName: ""  # NEW: Empty = cluster default
```

**Added EKS-specific documentation:**
- Documented EBS CSI driver requirements
- Provided storage class YAML examples (gp3, io2)
- Explained WaitForFirstConsumer for AZ affinity
- Listed recommended instance types (r6i, i3en)

**Added node affinity examples (commented out):**
```yaml
kafka:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: node.kubernetes.io/instance-type
              operator: In
              values:
                - r6i.xlarge
                - r6i.2xlarge
```

### 2. Kafka Template (`helm/templates/kafka-cluster.yaml`)

**Added storage class support:**
```yaml
storage:
  type: persistent-claim
  size: {{ .Values.kafka.storage.size }}
  {{- with .Values.kafka.storage.storageClassName }}
  storageClassName: {{ . | quote }}
  {{- end }}
  deleteClaim: false
```

### 3. PostgreSQL Template (`helm/templates/postgresql-cluster.yaml`)

**Already had storage class support** (from previous work on this branch):
```yaml
storage:
  size: {{ .Values.postgresql.storage.size }}
  {{- with .Values.postgresql.storage.storageClassName }}
  storageClassName: {{ . | quote }}
  {{- end }}
```

### 4. Documentation (`docs/eks-deployment-guide.md`)

**Created comprehensive EKS deployment guide** covering:
- Prerequisites (EBS CSI driver, storage classes, node groups)
- Step-by-step deployment instructions
- Troubleshooting section for common EKS issues
- EKS best practices applied
- References to AWS documentation

## Why These Changes?

### Problem

The colleague's EKS deployment was failing because:
1. **No explicit storage class** — EKS default is `gp2` (legacy), which may not be optimal
2. **Missing EBS CSI driver documentation** — EKS requires explicit EBS CSI driver installation
3. **No AZ affinity** — Without `WaitForFirstConsumer`, volumes may be provisioned in different AZs than pods, causing cross-AZ charges and latency
4. **No node group guidance** — Stateful workloads (Kafka, PostgreSQL) need dedicated node groups with appropriate instance types

### Solution

1. **Explicit storage class configuration** — Allows operators to specify `gp3` (best value) or `io2` (low-latency) for EKS
2. **Documentation** — Provides clear instructions for EBS CSI driver installation and storage class creation
3. **WaitForFirstConsumer** — Ensures volumes and pods are in the same AZ for optimal performance
4. **Node affinity examples** — Shows how to schedule stateful workloads on appropriate instance types

## Backward Compatibility

These changes are **100% backward compatible**:
- `storageClassName: ""` (empty) means "use cluster default"
- On GKE AutoPilot, this uses `standard` (pd-standard) or `premium-ssd` (pd-ssd)
- On kind/minikube, this uses whatever default storage class exists
- No breaking changes to existing deployments

## Testing on EKS

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

# 3. Deploy Meridian City with EKS storage class
./scripts/deploy.sh install \
  --set postgresql.storage.storageClassName=gp3 \
  --set kafka.storage.storageClassName=gp3

# 4. Verify
./scripts/deploy.sh status
kubectl get pvc -n meridian-<hash>
```

### Expected Behavior

- Kafka and PostgreSQL pods should become `Running` and `Ready`
- PVCs should be in `Bound` state
- No `Pending` pods waiting for volumes

## References

### AWS Documentation
- [EBS CSI Driver on EKS](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
- [Storage Classes](https://docs.aws.amazon.com/eks/latest/userguide/storage-classes.html)
- [EKS Best Practices](https://docs.aws.amazon.com/eks/latest/userguide/eks-best-practices.html)

### Strimzi Documentation
- [Strimzi on EKS](https://strimzi.io/docs/operators/latest/deploying/)
- [KafkaNodePool Storage](https://strimzi.io/docs/operators/latest/full/deploying.html#_kafkanodepool_spec_storage)

### CloudNativePG Documentation
- [CloudNativePG on EKS](https://cloudnative-pg.io/documentation/current/installation/)
- [Storage Configuration](https://cloudnative-pg.io/documentation/current/persistent_storage/)

## Next Steps

1. **Test on EKS** — Have your colleague deploy on EKS and verify
2. **Monitor** — Check pod status and PVC binding
3. **Optimize** — Consider adding node affinity, resource quotas, and network policies for production
4. **Backup** — Set up AWS Backup for EBS volumes (production only)

## Support

If you encounter issues:
1. Check `docs/eks-deployment-guide.md` for troubleshooting
2. Verify EBS CSI driver is installed and working
3. Confirm storage class exists and is correct
4. Check pod and PVC status with `kubectl describe`

For EKS-specific issues not covered here, please open an issue on GitHub with:
- EKS cluster version
- Kubernetes version
- Error messages from pods
- `kubectl describe pvc` output
- `kubectl get sc` output