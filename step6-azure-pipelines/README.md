# Deploying from Azure Pipelines

1. Create a new project for testing the pipeline

2. Config Git Remote to AzureDevops
```bash
git remote set-url origin <NEW_URL>
```

3. Create an identity for the Azure DevOps pipeline

```bash
az identity create \
  --name id-ado-pipeline \
  --resource-group $RG \
  --location southeastasia
```

2. create Service Connection on AzureDevOp

**Azure DevOps → Project Settings → Service connections → New service connection → Azure
   Resource Manager**

   - Identity type: managed identity
   - Subscription for managed identity: <YOUR_SUBSCRIPTION>
   - Resource group for managed identity: <RESOURCE_GROUP_MANAGED_IDENTITY>
   - Managed Identity: id-ado-pipeline
   - Service connection name: sc-aks

4. Assign the cluster roles to the managed identity (`id-ado-pipeline`):

```bash
# Storage Blob Data Reader
PRINCIPAL_ID=$(az identity show -g $RG -n id-ado-pipeline --query principalId -o tsv)

# Azure Kubernetes Service RBAC Writer, Deployments, Pods, Services, Ingress within namespace
# Azure Kubernetes Service RBAC Admin, manage Custom Resource Definitions (CRD) and create namespace
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Azure Kubernetes Service RBAC Admin" \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourcegroups/$RG/providers/Microsoft.ContainerService/managedClusters/$CLUSTER
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

3. RUN Pipeline on AzureDevOps
