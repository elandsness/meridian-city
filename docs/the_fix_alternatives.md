# The Fix — Alternative Approaches

If the `eksctl create iamserviceaccount` command is failing, here are alternative methods to fix the EBS CSI driver IAM configuration.

## Option 1: Manual IAM Role Creation (AWS CLI)

This is the most reliable method when `eksctl` is not available or failing.

### Step 1: Create the IAM Role

```bash
# Create the trust policy JSON
cat > /tmp/ebs-csi-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/oidc.eks.<REGION>.amazonaws.com/id/<OIDC_ID>"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.<REGION>.amazonaws.com/id/<OIDC_ID>:sub": "system:serviceaccount:kube-system:ebs-csi-controller-sa"
        }
      }
    }
  ]
}
EOF

# Replace the placeholders
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=<YOUR_REGION>  # e.g., us-east-1
CLUSTER_NAME=dxc-meridian-eks

# Get OIDC provider info
OIDC_ENDPOINT=$(aws eks describe-cluster --name $CLUSTER_NAME --query "cluster.identity.oidc.issuer" --output text | sed 's|https://||')
OIDC_ID=$(echo $OIDC_ENDPOINT | cut -d'.' -f1)

# Create the role
aws iam create-role \
  --role-name AmazonEKS_EBS_CSI_DriverRole \
  --assume-role-policy-document file:///tmp/ebs-csi-trust-policy.json \
  --description "Role for EBS CSI driver"

# Attach the policy
aws iam attach-role-policy \
  --role-name AmazonEKS_EBS_CSI_DriverRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicyV2

# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name AmazonEKS_EBS_CSI_DriverRole --query Role.Arn --output text)

echo "Role ARN: $ROLE_ARN"
```

### Step 2: Annotate the Kubernetes Service Account

```bash
# Patch the service account with the IAM role ARN
kubectl patch serviceaccount ebs-csi-controller-sa \
  -n kube-system \
  -p "{\"metadata\": {\"annotations\": {\"eks.amazonaws.com/role-arn\": \"ROLE_ARN\"}}"

# Replace ROLE_ARN with the actual ARN from Step 1
```

### Step 3: Delete Crashing Pods

```bash
kubectl delete pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

### Step 4: Verify

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

---

## Option 2: AWS Console (GUI)

This is the easiest method if you prefer a visual interface.

### Step 1: Create IAM Role

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click **Roles** → **Create role**
3. Select **Web identity** as the trusted entity type
4. Choose:
   - Identity provider: **OpenID Connect**
   - Audience: `sts.amazonaws.com`
   - Click **Add another provider** → **EKS** → select your cluster
5. Click **Next: Permissions**
6. Search for and attach: **AmazonEBSCSIDriverPolicyV2**
7. Click **Next: Tags** → **Next: Review**
8. Role name: `AmazonEKS_EBS_CSI_DriverRole`
9. Click **Create role**

### Step 2: Note the Role ARN

After creating the role, copy the **Role ARN** (looks like: `arn:aws:iam::123456789012:role/AmazonEKS_EBS_CSI_DriverRole`).

### Step 3: Annotate the Kubernetes Service Account

Run this command in your terminal:

```bash
kubectl patch serviceaccount ebs-csi-controller-sa \
  -n kube-system \
  -p "{\"metadata\": {\"annotations\": {\"eks.amazonaws.com/role-arn\": \"YOUR_ROLE_ARN_HERE\"}}"
```

Replace `YOUR_ROLE_ARN_HERE` with the actual ARN.

### Step 4: Delete Crashing Pods

```bash
kubectl delete pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

### Step 5: Verify

```bash
kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-ebs-csi-driver
```

---

## Option 3: Use AWS Console to Manage EKS Cluster

Some EKS clusters have a built-in option to manage the EBS CSI driver.

### Step 1: Go to EKS Console

1. Go to [AWS EKS Console](https://console.aws.amazon.com/eks/)
2. Select your cluster: `dxc-meridian-eks`
3. Click **Compute** in the left sidebar
4. Look for **Managed node groups** or **Add-ons**

### Step 2: Check/Add EBS CSI Driver

1. Click **Add-ons** in the left sidebar
2. Look for **EBS CSI driver** in the list
3. If it's listed but broken, click **Update** and follow the wizard
4. If it's not listed, click **Create add-on** → **EBS CSI driver** → follow the wizard

The wizard will automatically:
- Create the IAM role
- Attach the correct policy
- Annotate the service account
- Install/upgrade the driver

---

## Troubleshooting

### Check if the Service Account is Annotated

```bash
kubectl get sa ebs-csi-controller-sa -n kube-system -o yaml
```

Look for this annotation:
```yaml
metadata:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/AmazonEKS_EBS_CSI_DriverRole
```

### Check Pod Logs

```bash
kubectl logs -n kube-system <controller-pod-name>
```

Look for errors like:
- `Failed to assume role` → IAM role not configured correctly
- `AccessDenied` → Policy not attached
- `InvalidIdentityToken` → OIDC provider not configured

### Verify OIDC Provider

```bash
aws eks describe-cluster --name dxc-meridian-eks --query "cluster.identity.oidc.issuer" --output text
```

Should return something like: `https://oidc.eks.us-east-1.amazonaws.com/id/XXXXXXXXXXXXXXXXXXXXXXXXXX`

### Verify IAM Role Exists

```bash
aws iam get-role --role-name AmazonEKS_EBS_CSI_DriverRole
```

### Verify Policy is Attached

```bash
aws iam list-attached-role-policies --role-name AmazonEKS_EBS_CSI_DriverRole
```

Should show `AmazonEBSCSIDriverPolicyV2` in the output.

---

## References

- [AWS EBS CSI Driver Documentation](https://docs.aws.amazon.com/eks/latest/userguide/ebs-csi.html)
- [Setting Up the EBS CSI Driver](https://docs.aws.amazon.com/eks/latest/userguide/managing-ebs-csi.html)
- [IAM Roles for Service Accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
