# Lab 3 — Mount a secret from Key Vault · 15 minutes

## 1. Create Keyvault resource 
```bash
export KEYVALUT_NAME="YOUR_KEYVAULT_NAME"
az keyvault create \
  --name $KEYVALUT_NAME \
  --resource-group $RG \
  --location southeastasia
```

## 2. create manage identity and federated
```bash
export IDENTITY_NAME="IDENTITY_NAME"
az identity create -g $RG -n $IDENTITY_NAME -l southeastasia
```

```
OIDC=$(az aks show -g $RG -n $CLUSTER --query oidcIssuerProfile.issuerUrl -o tsv)

# federated credential
az identity federated-credential create \
  --name fc-orders-api \
  --identity-name $IDENTITY_NAME -g $RG \
  --issuer "$OIDC" \
  --subject system:serviceaccount:$NAMESPACE:orders-api \
  --audience api://AzureADTokenExchange
```

## 2. assine role to keyvault
```bash
PRINCIPAL_ID=$(az identity show -g $RG -n $IDENTITY_NAME --query principalId -o tsv

# "Key Vault Secrets User" get , list only if full access pls use "Key Vault Administrator" 
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $PRINCIPAL_ID \
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

## 3. create secret object 
```bash
az keyvault secret set \
  --vault-name $KEYVALUT_NAME \
  --name db-password \
  --value "secret"
```

## 4. Create the SecretProviderClass

Edit `k8s/secretproviderclass.yaml` and fill in three values from your card —
`<CLIENT_IDENTITY>`, `<KEY-VAULT>` and `<TENANT-ID>` — then:

```bash
kubectl apply -f k8s/secretproviderclass.yaml
```

## 5. Add a sa, volume and month it to your Deployment

**ADD 1 - enable workload identity, at `spec.template.metadata.labels.azure.workload.identity/user`
```yaml
        azure.workload.identity/user: "true"
```
**ADD 2 - serviceAccountName , at `spec.template.spec.serviceAccountName` **
```yaml
      serviceAccountName: orders-api
```

**ADD 3 - secret as the volume , at `spec.template.spec.volums` **
```yaml
      volumes:              # ← ADD THIS BLOCK
      - name: secrets
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: orders-api-spc
```

**ADD 4 — the mount the secret, at `spec.template.spec.containers[0].volumeMounts`**
```yaml
        volumeMounts:       # ← ADD THIS BLOCK
        - name: secrets
          mountPath: /mnt/secrets-store
          readOnly: true
```

## 5. apply and testing

- apply 
```bash
kubectl apply -f k8s/deployment.yaml
```
- testing
```bash
POD=$(kubectl get pod -l app=orders-api --sort-by=.metadata.creationTimestamp -o name | tail -1)
kubectl exec $POD -- cat /mnt/secrets-store/db-password
```
- call the api 
```bash
kubectl exec $POD -- curl -s localhost:8080/secret
```
