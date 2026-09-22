# Deploying from Azure Pipelines

**Create the new project for testing pipeline first**

## Config Service Connect
1. Create identity for azure devop pipeline
```bash
az identity create \
  --name id-ado-aks \
  --resource-group $RG\
  --location southeastasia
```

2. **Azure DevOps → Project Settings → Service connections → New service connection → Azure
   Resource Manager**
   New Azure Service Connection
   - Identity type : App registration or managed identity (manual)
   - Credential : Workload identity federation
   - Service Connection Name : <Your Service Connect Name>
   - Directory (tenant) ID : <Your Tenant ID>

and click next , and file the app registration details for Step 2
copy Issue and Subject identifier from text box
- Scope Leve : subscription
- Subscription ID : <Your Subscription ID>
- Subsription Name : <Your Subscription Name>
- Application (client) ID : <Your manage identity client id(id-ado-aks)>

3. go back to the your manage identity (id-ado-aks) , create the federated credentials, click add the new credential
- Federated credential scenario : 
- Issuer URL : <The Issuer from Azure DevOps step2>
- Subject identifier : <The identifier from Azure DevOps step2
- Credential Name : <Your credential Name e.g. fic-ado-pipeline>

4. Assige `reader role` to subscription level for manage identity (id-ado-aks)

5. goback to the azure Devop create service connection and then click on the verify and save buttom.

6. Assign mmanage identity(id-ado-aks) for `Azure Kubernetes Service RBAC Admin` to AKS custer
```
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Azure Kubernetes Service Cluster User Role" \
  --scope $AKS_RESOUCE_ID

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Azure Kubernetes Service RBAC Cluster Admin" \
  --scope $AKS_RESOUCE_ID
```
---
## Pipeline config
1. push the lab code to the new repo
2. create variable group

group name : aks-deploy

Variable
-|-
CLUSTER|<Your Cluster Name>
NAMESPACE|<Your name space>
RESOURCE_GROUP|<Your ReourceGroup>

3. change the service connect name in the pipeline 
```
  - task: AzureCLI@2
    displayName: Deploy to AKS
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    inputs:
      azureSubscription: test #<- change this
```






