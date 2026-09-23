# Deploying from Azure Pipelines

**Create a new project for testing the pipeline first.**

## Configure the service connection

1. Create an identity for the Azure DevOps pipeline

```bash
az identity create \
  --name id-ado-pipeline \
  --resource-group $RG \
  --location southeastasia
```
2. create Azure DevOps Organize and Repo

**Azure DevOps → Project Settings → Service connections → New service connection → Azure
   Resource Manager**

   - Identity type: managed identity
   - Subscription for managed identity: <YOUR_SUBSCRIPTION>
   - Resource group for managed identity: <RESOURCE_GROUP_MANAGED_IDENTITY>
   - Managed Identity: id-ado-pipeline
   - Service connection name: sc-aks

3. Assign the **Reader** role at subscription level to the managed identity (`id-ado-aks`).

4. Assign the cluster roles to the managed identity (`id-ado-aks`):

```bash
# Azure Kubernetes Service RBAC Writer, Deployments, Pods, Services, Ingress within namespace
# Azure Kubernetes Service RBAC Admin, manage Custom Resource Definitions (CRD) and create namespace
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Azure Kubernetes Service RBAC Writer" \
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
