# Deploying from Azure Pipelines

**Create a new project for testing the pipeline first.**

## Configure the service connection

1. Create an identity for the Azure DevOps pipeline

```bash
az identity create \
  --name id-ado-aks \
  --resource-group $RG \
  --location southeastasia
```

2. **Azure DevOps → Project Settings → Service connections → New service connection → Azure
   Resource Manager**

   - Identity type: App registration or managed identity (manual)
   - Credential: Workload identity federation
   - Service connection name: `<your service connection name>`
   - Directory (tenant) ID: `<your tenant ID>`

   Click **Next**, then fill in the app registration details:

   - Scope level: Subscription
   - Subscription ID: `<your subscription ID>`
   - Subscription name: `<your subscription name>`
   - Application (client) ID: `<the client ID of your managed identity, id-ado-aks>`

   Copy the **Issuer** and the **Subject identifier** from the text boxes — you need both in
   step 3. Leave this page open.

3. Go back to your managed identity (`id-ado-aks`) and create the federated credential.
   Click **Add credential**:

   - Federated credential scenario: Other issuer
   - Issuer URL: `<the Issuer from Azure DevOps, step 2>`
   - Subject identifier: `<the Subject identifier from Azure DevOps, step 2>`
   - Credential name: `<your credential name, e.g. fic-ado-pipeline>`

4. Assign the **Reader** role at subscription level to the managed identity (`id-ado-aks`).

5. Go back to the service connection in Azure DevOps and click **Verify and save**.

6. Assign the cluster roles to the managed identity (`id-ado-aks`):

```bash
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Azure Kubernetes Service Cluster User Role" \
  --scope $AKS_RESOURCE_ID

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Azure Kubernetes Service RBAC Cluster Admin" \
  --scope $AKS_RESOURCE_ID
```

---

## Pipeline configuration

1. Push the lab code to the new repository.

2. Create a variable group named `aks-deploy`:

| Variable | Value |
|---|---|
| `CLUSTER` | `<your cluster name>` |
| `NAMESPACE` | `<your namespace>` |
| `RESOURCE_GROUP` | `<your resource group>` |

3. Change the service connection name in the pipeline:

```yaml
  - task: AzureCLI@2
    displayName: Deploy to AKS
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    inputs:
      azureSubscription: test   # <- change this
```
