# Lab 3 — Mount a secret from Key Vault · 15 minutes

## 1. Create Keyvault resource 
```bash
export KEYVALUT_NAME="YOUR_KEYVAULT_NAME"
az keyvault create \
  --name $KEYVALUT_NAME \
  --resource-group $RG \
  --location southeastasia
```

2. assine role to keyvault
```bash
CLIENT_ID=$(az aks show \
  --resource-group "$RG" \
  --name "$CLUSTER" \
  --query identityProfile.kubeletidentity.clientId \
  --output tsv)

# "Key Vault Secrets User" get , list only if full access pls use "Key Vault Administrator" 
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $CLIENT_ID \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KEYVALUT_NAME"

# Key Vault Secrets User --> get,list
# Key Vault Secrets Officer --> get,list,create,delete
# Key Vault Administrator --> manage RBAC
MY_OBJ_ID=$(az ad signed-in-user show --query id --output tsv)
az role assignment create \
  --role "Key Vault Administrator" \
  --assignee $MY_OBJ_ID \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG/providers/Microsoft.KeyVault/vaults/$KEYVALUT_NAME"
```
3. create secret object 
```bash
az keyvault secret set \
  --vault-name $KEYVALUT_NAME \
  --name db-password \
  --value "secret"
```

4. Create the SecretProviderClass

Edit `k8s/secretproviderclass.yaml` and fill in three values from your card —
`<CSI_IDENTITY>`, `<KEY-VAULT>` and `<TENANT-ID>` — then:

```bash
kubectl apply -f k8s/secretproviderclass.yaml
```

## 2. Add a volume to your Deployment

Two blocks go into `k8s/deployment.yaml`, the file you deployed in Lab 2, **and they go in
two different places**. Missing the second one is the commonest mistake in this lab: the pod
starts perfectly and the secret simply is not there.

**ADD 1 — the volume, at `spec.template.spec.volumes`**

A sibling of `containers`, at the same indentation as it:

```yaml
spec:                       # ← Deployment spec
  template:
    spec:                   # ← pod spec
      volumes:              # ← ADD THIS BLOCK
      - name: secrets
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: orders-api-spc
      containers:           # ← already there
      - name: orders-api
```

**ADD 2 — the mount, at `spec.template.spec.containers[0].volumeMounts`**

Inside the container, alongside `ports` and `resources`:

```yaml
      containers:
      - name: orders-api
        image: ...          # already there
        volumeMounts:       # ← ADD THIS BLOCK
        - name: secrets
          mountPath: /mnt/secrets-store
          readOnly: true
```

`name: secrets` has to match in both — that is what joins the mount to the volume.

`lab3-secret/solution/deployment.yaml` has the exact indentation if you want to compare.

```bash
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deploy/orders-api
```

## 3. Read it from inside the pod

```bash
POD=$(kubectl get pod -l app=orders-api --sort-by=.metadata.creationTimestamp -o name | tail -1)
kubectl exec $POD -- cat /mnt/secrets-store/db-password
```

or call the api 
```bash
kubectl exec $POD -- curl -s localhost:8080/secret
```
