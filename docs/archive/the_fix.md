# The Fix — EBS CSI Driver CrashLoopBackOff

## Problem

The EBS CSI driver is installed on EKS, but the controller pods are crashing (CrashLoopBackOff). This causes all PVCs to remain in **Pending** state because volumes cannot be provisioned.

## Root Cause

The controller pods can't access AWS APIs due to missing or misconfigured IAM permissions (IRSA — IAM Roles for Service Accounts).

## Solution

Run these commands on your EKS cluster in order:

### Step 1: Fix the IAM Role

```bash
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster dxc-meridian-eks \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2 \
  --approve --role-only --role-name AmazonEKS_EBS_CSI_DriverRole
```

This creates the IAM role (if it doesn't exist) and attaches the required policy.

### Step 2: Delete Crashing Pods

```bash
kubectl delete pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

This triggers Kubernetes to restart the controller pods with the new IAM configuration.

### Step 3: Verify Driver is Healthy

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

All controller pods should show `Running` and `1/6 Ready` (or higher). No pods should be in `CrashLoopBackOff`.

### Step 4: Redeploy Meridian City

```bash
./scripts/deploy.sh upgrade
```

This will trigger the storage class setup job, which will create the `meridian-gp3` and `meridian-io2` storage classes. PVCs should then bind successfully.

### Step 5: Verify PVCs are Bound

```bash
kubectl get pvc -n meridian-zgv8
```

All PVCs should show `Bound` status.

### Step 6: Verify Pods are Running

```bash
kubectl get pods -n meridian-zgv8
```

All pods should show `Running` and `Ready` status.

## Troubleshooting

If controller pods are still crashing after Step 2:

1. Check the pod logs:
   ```bash
   kubectl logs -n kube-system <controller-pod-name>
   ```

2. Verify the IAM role exists:
   ```bash
   aws iam get-role --role-name AmazonEKS_EBS_CSI_DriverRole
   ```

3. Verify the policy is attached:
   ```bash
   aws iam list-attached-role-policies --role-name AmazonEKS_EBS_CSI_DriverRole
   ```

4. Check the service account annotation:
   ```bash
   kubectl get sa ebs-csi-controller-sa -n kube-system -o yaml
   ```
   Look for the `eks.amazonaws.com/role-arn` annotation.

## References

- [AWS EBS CSI Driver Documentation](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
- [Setting Up the EBS CSI Driver](https://docs.aws.amazon.com/eks/latest/userguide/managing-ebs-csi.html)
- [IAM Roles for Service Accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
