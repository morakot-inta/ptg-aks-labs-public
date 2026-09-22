# Deploying from Azure Pipelines

Demonstrated in the session rather than practised — but this is the file, ready to copy.

## Before this runs at all: create the service connection

One-time setup for whoever demos this, not something attendees do.

1. **Azure DevOps → Project Settings → Service connections → New service connection → Azure
   Resource Manager**

2. create variable group

group name : aks-deploy

Variable
CLUSTER : <Your Cluster Name>
NAMESPACE : <Your name space>
RESOURCE_GROUP : <Your ReourceGroup>






