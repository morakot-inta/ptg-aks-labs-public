# Building the lab environment — copy and paste

For the platform team. Every block below is meant to be pasted into
**[Azure Cloud Shell](https://shell.azure.com)** (Bash) in order.

Cloud Shell is the easiest place to run this: `az` and `kubectl` are already there and
always current, so the `azure-cli 2.86.0` requirement in Step 2 takes care of itself.

Two steps need files from this repository — building the image in Step 4, and the
deliberately broken manifest in Step 9. Clone it first and stay in the root:

```bash
git clone <this repository> && cd <repository>
```

---

## Step 0 · Set your values

**Edit these, then paste the whole block.** Everything after this uses them.

```bash
SUBSCRIPTION="00000000-0000-0000-0000-000000000000"
RG="rg-aks-training"
LOCATION="southeastasia"
CLUSTER="aks-training"
ACR="acrtraining"                 # no .azurecr.io
KEYVAULT="kv-aks-training"
STORAGE="staktraining"            # 3-24 chars, lowercase, globally unique
CONTAINER="lab-data"
IDENTITY="id-aks-lab"
GATEWAY_NS="gateway-system"
GATEWAY_NAME="shared-gateway"
DOMAIN="lab.example.com"
SERVICE_ACCOUNT="orders-api"

az account set --subscription "$SUBSCRIPTION"
az account show --query name -o tsv          # confirm this is the right one
```

---

## Step 1 · Check the cluster has the right shape

```bash
az aks show -g "$RG" -n "$CLUSTER" --query '{
  oidc:oidcIssuerProfile.enabled,
  workloadIdentity:securityProfile.workloadIdentity.enabled,
  overlay:networkProfile.networkPluginMode,
  entraRBAC:aadProfile.enableAzureRbac,
  privateCluster:apiServerAccessProfile.enablePrivateCluster,
  istio:serviceMeshProfile.istio.revisions,
  keyVaultCsi:addonProfiles.azureKeyvaultSecretsProvider.enabled
}' -o yaml
```

What you want to see:

| Field | Expected | If it is wrong |
|---|---|---|
| `oidc`, `workloadIdentity` | `true` | `az aks update -g $RG -n $CLUSTER --enable-oidc-issuer --enable-workload-identity` |
| `overlay` | `overlay` | Cannot be changed after creation. The labs still run; one sentence in Lab 4 about pod addressing stops being true |
| `entraRBAC` | `true` | `az aks update -g $RG -n $CLUSTER --enable-aad --enable-azure-rbac`. **Without this, attendees cannot be confined to their own namespace** |
| `privateCluster` | `false` or null | A private cluster cannot be reached from attendee laptops |
| `istio` | `asm-1-26` or later | `az aks mesh enable -g $RG -n $CLUSTER` |
| `keyVaultCsi` | `true` | Step 2 turns it on. Lab 3 has nothing to mount without it |

---

## Step 2 · Turn on the add-ons the labs need

```bash
az aks enable-addons -g "$RG" -n "$CLUSTER" \
  --addons azure-policy,azure-keyvault-secrets-provider

az aks update -g "$RG" -n "$CLUSTER" --enable-gateway-api
```

> The Key Vault add-on creates its own managed identity,
> `azurekeyvaultsecretsprovider-<cluster>`, in the `MC_` node resource group and attaches it
> to the node pool VMSS. **That is the identity Lab 3 uses** — not `id-aks-lab`, which is
> created in step 6 for Lab 4. Step 5 gives it access to the vault.

Then connect and confirm:

```bash
az aks get-credentials -g "$RG" -n "$CLUSTER" --overwrite-existing
kubectl get gatewayclass                     # expect "istio", ACCEPTED=True
```

---

## Step 3 · Assign the four policies Lab 2 depends on

The add-on on its own enforces nothing. These four are what refuse the deliberately broken
manifest in Lab 2.

```bash
RG_SCOPE=$(az group show -n "$RG" --query id -o tsv)
ACR_LOGIN=$(az acr show -n "$ACR" --query loginServer -o tsv)

pol() { az policy definition list --query "[?displayName=='$1'].id | [0]" -o tsv; }

az policy assignment create --name lab-allowed-images \
  --policy "$(pol 'Kubernetes cluster containers should only use allowed images')" \
  --scope "$RG_SCOPE" \
  --params "{\"effect\":{\"value\":\"deny\"},\"allowedContainerImagesRegex\":{\"value\":\"^${ACR_LOGIN}/.+$\"}}"

az policy assignment create --name lab-resource-limits \
  --policy "$(pol 'Kubernetes cluster containers CPU and memory resource limits should not exceed the specified limits')" \
  --scope "$RG_SCOPE" \
  --params '{"effect":{"value":"deny"},"cpuLimit":{"value":"2"},"memoryLimit":{"value":"2Gi"}}'

az policy assignment create --name lab-nonroot \
  --policy "$(pol 'Kubernetes cluster pods and containers should only run with approved user and group IDs')" \
  --scope "$RG_SCOPE" \
  --params '{"effect":{"value":"deny"},"runAsUserRule":{"value":"MustRunAsNonRoot"},"runAsGroupRule":{"value":"RunAsAny"},"supplementalGroupsRule":{"value":"RunAsAny"},"fsGroupRule":{"value":"RunAsAny"}}'

az policy assignment create --name lab-probes \
  --policy "$(pol 'Ensure cluster containers have readiness or liveness probes configured')" \
  --scope "$RG_SCOPE" \
  --params '{"effect":{"value":"deny"},"probes":{"value":["livenessProbe","readinessProbe"]}}'
```

> **Wait 15 to 20 minutes before testing.** Gatekeeper pulls policy on a schedule, so the
> rules do not bite immediately. Checking too early gives a false failure.

> **Check what kind of subscription this is before promising Lab 1.** ACR task runs are
> currently paused on subscriptions running from Azure free credits, and `az acr build`
> fails outright with `TasksOperationsNotAllowed`. A free trial, Azure for Students or
> sponsorship subscription cannot run Lab 1 at all, whatever the registry SKU.

---

## Step 4 · Build the image

```bash
# from a clone of this repository. Attendees build their own tag in Lab 1 —
# this one is the fallback for anyone whose build fails on the day, and it is
# what step 9 uses to prove the policies are in force.
az acr build --registry "$ACR" --image orders-api:v1 sample-app/

# let the cluster pull it without any imagePullSecret
az aks update -g "$RG" -n "$CLUSTER" --attach-acr "$ACR"
```

---

## Step 5 · Key Vault and storage

```bash
# --- Key Vault, and the secret Lab 3 mounts
az keyvault create -n "$KEYVAULT" -g "$RG" -l "$LOCATION" \
  --enable-rbac-authorization true --retention-days 7

# with RBAC authorisation the creator still needs a data-plane role to write secrets
az role assignment create \
  --assignee-object-id "$(az ad signed-in-user show --query id -o tsv)" \
  --assignee-principal-type User \
  --role "Key Vault Secrets Officer" \
  --scope "$(az keyvault show -n "$KEYVAULT" -g "$RG" --query id -o tsv)"

az keyvault secret set --vault-name "$KEYVAULT" -n db-password --value "this-is-not-a-real-password"

# --- the CSI driver reads the vault as the add-on's own identity, which is
#     already attached to the node pool. Lab 3 needs its CLIENT id; the role
#     assignment needs its OBJECT id
KV_CLIENT_ID=$(az aks show -g "$RG" -n "$CLUSTER" \
  --query addonProfiles.azureKeyvaultSecretsProvider.identity.clientId -o tsv)
KV_OBJECT_ID=$(az aks show -g "$RG" -n "$CLUSTER" \
  --query addonProfiles.azureKeyvaultSecretsProvider.identity.objectId -o tsv)

az role assignment create \
  --assignee-object-id "$KV_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope "$(az keyvault show -n "$KEYVAULT" -g "$RG" --query id -o tsv)"

echo "KV_CLIENT_ID for the attendee cards: $KV_CLIENT_ID"

# --- Storage, and the file Lab 4 reads
az storage account create -g "$RG" -n "$STORAGE" -l "$LOCATION" \
  --sku Standard_LRS --allow-blob-public-access false

az storage container create --account-name "$STORAGE" -n "$CONTAINER" --auth-mode login

printf 'Hello from Azure Storage.\nYou read this file with no access key.\n' > hello.txt
az storage blob upload --account-name "$STORAGE" -c "$CONTAINER" -n hello.txt \
  -f hello.txt --auth-mode login --overwrite
```

---

## Step 6 · The managed identity the pods will use

```bash
az identity create -g "$RG" -n "$IDENTITY" -l "$LOCATION"

IDENTITY_CLIENT=$(az identity show -g "$RG" -n "$IDENTITY" --query clientId -o tsv)
IDENTITY_PRINCIPAL=$(az identity show -g "$RG" -n "$IDENTITY" --query principalId -o tsv)
echo "client id for the attendee cards: $IDENTITY_CLIENT"

# it reads and writes the container (Contributor — Lab 4 uploads as well as downloads)
az role assignment create --assignee-object-id "$IDENTITY_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$(az storage account show -g "$RG" -n "$STORAGE" --query id -o tsv)/blobServices/default/containers/$CONTAINER"

# and reads the vault
az role assignment create --assignee-object-id "$IDENTITY_PRINCIPAL" \
  --assignee-principal-type ServicePrincipal \
  --role "Key Vault Secrets User" \
  --scope "$(az keyvault show -n "$KEYVAULT" -g "$RG" --query id -o tsv)"
```

---

## Step 7 · The shared Gateway for Step 5

```bash
kubectl create namespace "$GATEWAY_NS" --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f - <<YAML
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: ${GATEWAY_NAME}
  namespace: ${GATEWAY_NS}
spec:
  gatewayClassName: istio
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    hostname: "*.${DOMAIN}"
    allowedRoutes:
      namespaces:
        from: All
  infrastructure:
    annotations:
      service.beta.kubernetes.io/azure-load-balancer-internal: "true"
YAML

kubectl -n "$GATEWAY_NS" get gateway "$GATEWAY_NAME"
```

---

## Step 8 · A credential per attendee — but not their namespace

Attendees create their own namespace in Lab 0, so this step does not create it for them.
It creates everything that has to exist *before* that namespace does.

None of the built-in AKS roles allow it. **RBAC Writer** grants `namespaces/read` only, and
**RBAC Admin** excludes `namespaces/write` and `namespaces/delete` outright — the only
built-in role that can create a namespace is **RBAC Cluster Admin**, which hands every
attendee the whole cluster. So make a custom role that can do that one thing:

```bash
AKS_ID=$(az aks show -g "$RG" -n "$CLUSTER" --query id -o tsv)

cat > /tmp/aks-lab-ns-creator.json <<JSON
{
  "Name": "AKS Lab Namespace Creator",
  "Description": "Create a namespace on the training cluster. Nothing else.",
  "Actions": [],
  "DataActions": [
    "Microsoft.ContainerService/managedClusters/namespaces/read",
    "Microsoft.ContainerService/managedClusters/namespaces/write"
  ],
  "AssignableScopes": ["$AKS_ID"]
}
JSON

az role definition create --role-definition /tmp/aks-lab-ns-creator.json -o none
```

> Creating a role definition needs **Owner** or **User Access Administrator**, which is a
> higher bar than the rest of this runbook. The name must be unique across the tenant — if
> it already exists from a previous session, skip this block and reuse it.

**Then put your attendees here**, `namespace:sign-in`, and paste the whole block.

```bash
ATTENDEES="
alice:alice@example.com
bob:bob@example.com
"

OIDC=$(az aks show -g "$RG" -n "$CLUSTER" --query oidcIssuerProfile.issuerUrl -o tsv)
ACR_ID=$(az acr show -n "$ACR" --query id -o tsv)

for row in $ATTENDEES; do
  NS="${row%%:*}"; UPN="${row##*:}"
  echo "--- $NS ($UPN)"

  # sequential on purpose: creating these in parallel under one identity returns 409
  az identity federated-credential create \
    --name "fc-$NS" --identity-name "$IDENTITY" -g "$RG" \
    --issuer "$OIDC" \
    --subject "system:serviceaccount:${NS}:${SERVICE_ACCOUNT}" \
    --audience api://AzureADTokenExchange -o none

  # which identity this attendee was federated against, for their card. With
  # more than 20 attendees this is a second identity with a different client id
  echo "${NS}:${IDENTITY_CLIENT}" >> /tmp/attendee-cards.txt

  # lets them run az aks get-credentials
  az role assignment create --assignee "$UPN" \
    --role "Azure Kubernetes Service Cluster User Role" --scope "$AKS_ID" -o none

  # lets them create the namespace in Lab 0, and nothing else cluster-wide
  az role assignment create --assignee "$UPN" \
    --role "AKS Lab Namespace Creator" --scope "$AKS_ID" -o none

  # lets them edit things, in their own namespace only. The scope is an Azure
  # string, so it is assignable before the namespace itself exists
  az role assignment create --assignee "$UPN" \
    --role "Azure Kubernetes Service RBAC Writer" \
    --scope "${AKS_ID}/namespaces/${NS}" -o none

  # lets them queue a build in Lab 1. NOT AcrPush: that is data-plane only
  # (pull/read and push/write), and az acr build has to schedule a task run,
  # which is a control-plane action. AcrPull is for reading back the tag list
  az role assignment create --assignee "$UPN" \
    --role "Container Registry Tasks Contributor" --scope "$ACR_ID" -o none

  az role assignment create --assignee "$UPN" \
    --role "AcrPull" --scope "$ACR_ID" -o none
done
```

> **Namespace names are fixed in advance even though attendees type them.** The federated
> credential above names `system:serviceaccount:<ns>:orders-api`, and Step 5's hostname is
> `<ns>.$DOMAIN`. Someone who invents their own name in Lab 0 will pass Lab 2 and then fail
> Lab 4 for reasons nobody can debug in the room. Put the name on the card.

> **One managed identity holds at most 20 federated credentials.** For more than 20
> attendees, create a second identity (`IDENTITY="id-aks-lab-2"`, repeat Step 6, which
> refreshes `$IDENTITY_CLIENT`) and run this block again with the remaining names. Step 10
> reads `/tmp/attendee-cards.txt`, so each card gets the client id that actually matches its
> namespace — the two groups do not share one.

> **Starting over?** `rm -f /tmp/attendee-cards.txt` before re-running, or step 10 prints
> duplicate cards.

> **Run this at least an hour before the session.** A token requested before the credential
> has propagated fails with `AADSTS70021`, and it looks exactly like attendee error.

---

## Step 9 · Prove it works

Do not assume — the two failures that matter are both invisible to a resource listing.

```bash
kubectl create namespace preflight --dry-run=client -o yaml | kubectl apply -f -

# this manifest breaks four rules. It MUST be rejected.
kubectl -n preflight apply -f lab2-deployment/deployment-broken.yaml
```

**If that manifest is accepted, stop.** The policies are not in force, and Lab 2 has no
lesson left in it. Wait longer, or check Step 3.

```bash
# the image is where the labs expect
az acr repository show --name "$ACR" --image orders-api:v1 -o none && echo "image OK"

# the file Lab 4 reads
az storage blob show --account-name "$STORAGE" -c "$CONTAINER" -n hello.txt \
  --auth-mode login -o none && echo "hello.txt OK"

kubectl delete namespace preflight
```

---

## Step 10 · The attendee cards

One card per attendee. Lab 0 step 2 has them paste the block into `~/aks-lab.env` and
source it, so print the block itself rather than a table — a value that is retyped is a
value that is mistyped.

```bash
TENANT=$(az account show --query tenantId -o tsv)

while IFS=: read -r NS CLIENT; do
  cat <<CARD

================ $NS ================
export NAMESPACE="$NS"
export RG="$RG"
export CLUSTER="$CLUSTER"
export ACR="$ACR"
export CLIENT_ID="$CLIENT"
export KV_CLIENT_ID="$KV_CLIENT_ID"
export STORAGE_ACCOUNT="$STORAGE"

Your image (Lab 1)   : $ACR_LOGIN/orders-api:$NS
Your hostname (Step 5): $NS.$DOMAIN
Key Vault            : $KEYVAULT
Tenant               : $TENANT
If your build fails  : $ACR_LOGIN/orders-api:v1
CARD
done < /tmp/attendee-cards.txt
```

Everything above the blank line is meant to be pasted as-is. Everything below it is typed
into a YAML file by hand, which is why it is written out in full rather than as a variable.

---

## Afterwards · Tearing it down

```bash
for row in $ATTENDEES; do
  NS="${row%%:*}"
  kubectl delete namespace "$NS" --wait=false
done

az role definition delete --name "AKS Lab Namespace Creator"

kubectl -n "$GATEWAY_NS" delete gateway "$GATEWAY_NAME"
az identity delete -g "$RG" -n "$IDENTITY"
```

Deleting the whole resource group removes everything at once, including the cluster:

```bash
az group delete -n "$RG" --yes --no-wait
```
