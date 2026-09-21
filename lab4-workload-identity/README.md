# Lab 4 — Wire up Workload Identity · 45 minutes

## 0. Create Storage account

```bash
export STORAGE_ACCOUNT_NAME=""
```
```bash
az storage account create \
  --name $STORAGE_ACCOUNT_NAME \
  --resource-group $RG \
  --location southeastasia \
  --sku Standard_LRS
```
```bash
az storage container create \
  --name lab-data \
  --account-name $STORAGE_ACCOUNT_NAME \
  --auth-mode login
  ```

---

## 1. Create the ServiceAccount

create managed identity
```bash
az identity create \
  --name id-order-api \
  --resource-group $RG \
  --location southeastasia
```

```bash
kubectl apply -f k8s/serviceaccount.yaml
```

## 2. Three changes to your Deployment

Three changes, in three different places in `k8s/deployment.yaml`. The paths matter more
than the YAML does — two of these look like they belong somewhere they do not.

**A — at `spec.template.spec.serviceAccountName`**

Inside the pod spec, a sibling of `containers`:

```yaml
spec:
  template:
    spec:                                     # ← pod spec
      serviceAccountName: orders-api          # ← ADD
      securityContext:                        # already there
        runAsNonRoot: true
```

**B — at `spec.template.metadata.labels`**

On the **pod template's** metadata, not the Deployment's, and not on the ServiceAccount:

```yaml
spec:
  template:
    metadata:
      labels:
        app: orders-api                       # already there
        azure.workload.identity/use: "true"   # ← ADD
    spec:
      serviceAccountName: orders-api
```

This is the one almost everyone gets wrong. There is a `metadata:` at the top of the file
too, and putting the label there does nothing at all — no error, no warning, and no
identity.

**C — at `spec.template.spec.containers[0].env`**

Inside the container, alongside `ports` and `volumeMounts`:

```yaml
      containers:
      - name: orders-api
        image: ...                            # already there
        env:                                  # ← ADD
        - name: STORAGE_ACCOUNT
          value: "<STORAGE-ACCOUNT>"
        - name: NAMESPACE
          value: "<NAMESPACE>"
```

```bash
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deploy/orders-api
```

**Wait for the rollout.** A pod that started before your change has no identity, and every
endpoint below will lie to you about why.

## 3. Work through it in order

Three endpoints, on purpose — each one rules out a different problem.

```bash
POD=$(kubectl get pod -l app=orders-api --sort-by=.metadata.creationTimestamp -o name | tail -1)

# a) does this pod have an identity at all? (no storage involved)
kubectl exec $POD -- curl -s localhost:8080/whoami

# b) can that identity SEE the container?
kubectl exec $POD -- curl -s localhost:8080/storage
```

