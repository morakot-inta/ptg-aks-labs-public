# Deploying from Azure Pipelines

1. create identity for azure devop pipeline
```bash

```

2. **Azure DevOps → Project Settings → Service connections → New service connection → Azure
   Resource Manager**

3. create variable group

group name : aks-deploy

Variable
CLUSTER : <Your Cluster Name>
NAMESPACE : <Your name space>
RESOURCE_GROUP : <Your ReourceGroup>

3. Assign `Azure Kubernetes Service RBAC Admin` to AKS custer
```
```






