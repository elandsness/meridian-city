#!/bin/bash
# =============================================================================
# Diagnose EKS Storage Issues for Meridian City
# =============================================================================
# This script helps diagnose why PVCs are stuck in Pending state on EKS.
# Run this on the EKS cluster to identify the issue.
# =============================================================================

set -euo pipefail

NAMESPACE="${1:-meridian-55ep}"  # Default to the namespace from the issue

echo "=========================================="
echo "EKS Storage Diagnosis for Meridian City"
echo "=========================================="
echo ""

# Check 1: EBS CSI Driver Pods
echo "1. Checking EBS CSI driver pods..."
if kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver &>/dev/null; then
    echo "   ✅ EBS CSI driver pods found:"
    kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver -o wide
    echo ""

    # Check for CrashLoopBackOff
    CRASHING=$(kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver \
      -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.phase}{"\t"}{.status.containerStatuses[0].restartCount}{"\n"}{end}' 2>/dev/null | grep -v Running | grep -v Succeeded)

    if [[ -n "$CRASHING" ]]; then
        echo "   ⚠️  WARNING: Some EBS CSI driver pods are NOT running:"
        echo ""
        echo "   $CRASHING"
        echo ""
        echo "   This is the MOST COMMON cause of PVC Pending on EKS."
        echo "   The controller pods are crashing due to IAM/IRSA misconfiguration."
        echo ""
        echo "   FIX: Reinstall the EBS CSI driver with proper IAM:"
        echo ""
        CLUSTER_NAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "<ACCOUNT_ID>")
        echo "   eksctl create iamserviceaccount \\"
        echo "     --name ebs-csi-controller-sa \\"
        echo "     --namespace kube-system \\"
        echo "     --cluster $CLUSTER_NAME \\"
        echo "     --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2 \\"
        echo "     --approve --role-only --role-name AmazonEKS_EBS_CSI_DriverRole"
        echo ""
        echo "   Then delete the crashing pods to trigger restart:"
        echo "   kubectl delete pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver"
        echo ""
    else
        echo "   ✅ All EBS CSI driver pods are running"
    fi
else
    echo "   ❌ EBS CSI driver pods NOT found"
    echo ""
    echo "   The EBS CSI driver is REQUIRED for persistent volumes on EKS."
    echo "   Install it with:"
    echo ""
    CLUSTER_NAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')
    echo "   eksctl create iamserviceaccount \\"
    echo "     --name ebs-csi-controller-sa \\"
    echo "     --namespace kube-system \\"
    echo "     --cluster $CLUSTER_NAME \\"
    echo "     --role-name AmazonEKS_EBS_CSI_DriverRole \\"
    echo "     --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2 \\"
    echo "     --approve"
    echo ""
fi
echo ""

# Check 1b: EBS CSI Driver IAM Role
echo "1b. Checking EBS CSI driver IAM role..."
if command -v aws &>/dev/null; then
    ROLE_NAME="AmazonEKS_EBS_CSI_DriverRole"
    if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
        echo "   ✅ IAM role '$ROLE_NAME' exists"
        POLICY_ARN=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" \
          --query 'AttachedPolicies[?PolicyName==`AmazonEBSCSIDriverPolicyV2`].PolicyArn' --output text 2>/dev/null)
        if [[ -n "$POLICY_ARN" ]]; then
            echo "   ✅ Policy 'AmazonEBSCSIDriverPolicyV2' attached to role"
        else
            echo "   ⚠️  Policy 'AmazonEBSCSIDriverPolicyV2' NOT attached to role"
            echo "   Attach it with:"
            echo "   aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2"
        fi
    else
        echo "   ⚠️  IAM role '$ROLE_NAME' NOT found"
        echo "   Create it with:"
        echo "   eksctl create iamserviceaccount \\"
        echo "     --name ebs-csi-controller-sa \\"
        echo "     --namespace kube-system \\"
        echo "     --cluster <cluster-name> \\"
        echo "     --role-name $ROLE_NAME \\"
        echo "     --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2 \\"
        echo "     --approve"
    fi
else
    echo "   ⚠️  AWS CLI not found. Install it to verify IAM configuration."
fi
echo ""

# Check 2: Storage Classes
echo "2. Checking StorageClasses..."
kubectl get storageclass
echo ""

# Check 3: Default StorageClass
echo "3. Checking default StorageClass..."
DEFAULT_SC=$(kubectl get storageclass -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')
if [[ -n "$DEFAULT_SC" ]]; then
    echo "   Default StorageClass: $DEFAULT_SC"
    PROVISIONER=$(kubectl get storageclass "$DEFAULT_SC" -o jsonpath='{.provisioner}')
    echo "   Provisioner: $PROVISIONER"
    if [[ "$PROVISIONER" != "ebs.csi.aws.com" ]]; then
        echo "   ⚠️  WARNING: Default StorageClass provisioner is '$PROVISIONER'"
        echo "   Expected: ebs.csi.aws.com"
        echo ""
        echo "   To fix, set ebs.csi.aws.com as default:"
        echo "   kubectl patch storageclass ebs-csi-gp3 -p '{\"metadata\":{\"annotations\":{\"storageclass.kubernetes.io/is-default-class\":\"true\"}}}'"
    fi
else
    echo "   ❌ No default StorageClass found"
fi
echo ""

# Check 4: PVCs in Meridian Namespace
echo "4. Checking PVCs in namespace $NAMESPACE..."
kubectl get pvc -n "$NAMESPACE"
echo ""

# Check 5: PVC Events
echo "5. Checking PVC events (last 10 minutes)..."
kubectl get pvc -n "$NAMESPACE" -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | while read -r pvc; do
    echo "   PVC: $pvc"
    kubectl describe pvc "$pvc" -n "$NAMESPACE" | grep -A 5 "Events:" || echo "     No events"
    echo ""
done
echo ""

# Check 6: EBS Volumes
echo "6. Checking EBS volumes..."
if command -v aws &>/dev/null; then
    echo "   Using AWS CLI to check EBS volumes..."
    # Get the cluster name from kubectl
    CLUSTER_NAME=$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')
    # List EBS volumes (this may take a moment)
    echo "   Running: aws ec2 describe-volumes --filters Name=tag:eks:cluster-name,Values=$CLUSTER_NAME"
    aws ec2 describe-volumes --filters "Name=tag:eks:cluster-name,Values=$CLUSTER_NAME" --query 'Volumes[*].[VolumeId,Size,State,Tags]' --output table 2>&1 | head -20 || echo "   Could not query AWS (check AWS CLI configuration)"
else
    echo "   ⚠️  AWS CLI not found. Install it to check EBS volumes."
fi
echo ""

# Check 7: Storage Class Creation Job
echo "7. Checking storage class setup job..."
if kubectl get jobs -n "$NAMESPACE" | grep -q storage-class-setup; then
    echo "   Storage class setup job found:"
    kubectl get jobs -n "$NAMESPACE" | grep storage-class-setup
    echo ""
    echo "   Job logs:"
    JOB_NAME=$(kubectl get jobs -n "$NAMESPACE" -o jsonpath='{.items[?(@.metadata.labels.app.kubernetes.io/name=="storage-class-setup")].metadata.name}')
    if [[ -n "$JOB_NAME" ]]; then
        kubectl logs "$JOB_NAME" -n "$NAMESPACE" 2>&1 | head -30 || echo "   Could not read logs"
    fi
else
    echo "   ❌ Storage class setup job NOT found"
    echo "   This job should run before installation to create storage classes."
fi
echo ""

echo "=========================================="
echo "Diagnosis Complete"
echo "=========================================="
echo ""
echo "Common Issues:"
echo "1. EBS CSI driver controller crashing (CrashLoopBackOff) → Fix IAM/IRSA (see Check 1)"
echo "2. EBS CSI driver not installed → Install it (see Check 1)"
echo "3. Wrong default StorageClass → Patch to use ebs.csi.aws.com"
echo "4. Storage class setup job failed → Check job logs"
echo ""
echo "Next Steps:"
echo "- If EBS CSI driver is missing: Install it using the command in Check 1"
echo "- If PVCs are still Pending: Check EBS volume limits in AWS"
echo "- For manual workaround: Create PVs manually (not recommended for production)"