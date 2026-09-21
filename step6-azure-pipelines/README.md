# Deploying from Azure Pipelines

Demonstrated in the session rather than practised — but this is the file, ready to copy.

## Before this runs at all: create the service connection

One-time setup for whoever demos this, not something attendees do.

1. **Azure DevOps → Project Settings → Service connections → New service connection → Azure
   Resource Manager**
2. Choose **Workload identity federation (automatic)** — Azure DevOps creates the Entra app
   registration and federated credential for you. Use **manual** only if you do not have
   permission to create app registrations yourself and need to hand that part to someone who
   does.
3. Pick the subscription that holds the training cluster and ACR.
4. **Name it exactly `ptg-aks-wif`.** The pipeline YAML references this name directly — a
   different name here means `AzureCLI@2` fails to find the connection at all.
5. Grant access to all pipelines, or restrict it once you know which pipeline needs it.

Creating the connection only gets you a service principal that can authenticate — on its own
it can do nothing on the cluster. Grant it the same two roles an attendee gets in runbook
step 7, scoped to wherever this pipeline deploys:

```bash
SC_OBJECT_ID=<the service principal's object id — see below for where to find it>
AKS_ID=$(az aks show -g "$RG" -n "$CLUSTER" --query id -o tsv)

az role assignment create --assignee-object-id "$SC_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Azure Kubernetes Service Cluster User Role" --scope "$AKS_ID"

az role assignment create --assignee-object-id "$SC_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Azure Kubernetes Service RBAC Admin" \
  --scope "${AKS_ID}/namespaces/<namespace this pipeline deploys to>"
```

> **RBAC Admin, not RBAC Writer.** Confirmed against a live cluster: RBAC Writer's
> dataActions are an explicit allow-list of common resource types that does not include
> `secrets-store.csi.x-k8s.io/secretproviderclasses`, so `kubectl apply -f k8s/` fails on
> `secretproviderclass.yaml` with `does not have access to the resource in Azure` — even
> though the Kubernetes-level `edit` role it maps to does cover that resource. RBAC Admin's
> single wildcard dataAction covers every resource type, and the scope still confines it to
> one namespace.

> **Where to find the object id:** open the service connection → **Manage Service Principal**
> — this opens the app registration in Entra. Use the **Object ID** shown there, not the
> Application (client) ID. Role assignments need the object id.

## The one thing worth noticing

```yaml
  - task: AzureCLI@2
    inputs:
      azureSubscription: ptg-aks-wif   # workload identity federation
```

That service connection is the same mechanism you wired up in **Lab 4**. A workload proves
who it is and is handed a short-lived token, so no password or service-principal secret is
stored anywhere. In Lab 4 the workload was a pod; here it is a pipeline run. Same idea twice.

If your project still has a service connection created the old way — with a client secret —
that is the one thing worth changing. In the service connection's settings, **Convert** it to
workload identity federation.

## The line people forget

The cluster uses Microsoft Entra ID with Azure RBAC — the same thing that confines you to
your own namespace in Lab 0. That means `az aks get-credentials` on its own is not enough
from a pipeline:

```bash
kubelogin convert-kubeconfig -l azurepipelines
```

Without it, `kubectl` hangs waiting for a sign-in that will never come. The `azurepipelines`
mode reuses the service connection, so there is still nothing to store.

## Where it runs matters

Today's training cluster has a **public** API server, so a Microsoft-hosted agent can reach it.
**Your real cluster will not.**

| | Microsoft-hosted agent | Self-hosted agent, inside your network |
|---|---|---|
| Reaching a private API server | Cannot — no route in, and Azure DevOps' address ranges are too broad to allow | Normal internal traffic; nothing opened to the internet |
| Use it for | Build, test, push the image | Anything running `kubectl` against the cluster |

Most teams end up splitting one pipeline across both: build on a Microsoft-hosted agent,
deploy on a self-hosted agent in your own pool.

## It deploys the folder you have been editing

```yaml
        kubectl apply -f k8s/ -n $(NAMESPACE)
```

That is `k8s/` in this repository — the same `deployment.yaml`, `serviceaccount.yaml` and
`secretproviderclass.yaml` you edited by hand this afternoon. Nothing about them changes
when a pipeline applies them instead of you; that is the point of keeping them in the
repository in the first place.

Two things catch people out when they set that self-hosted agent up against the real
cluster. Its VNet being peered to the cluster's is not enough on its own — the agent's VNet
also needs a link to the `privatelink.<region>.azmk8s.io` private DNS zone, or the API
server's name will not resolve. And if nobody wants to run agent VMs, **Managed DevOps
Pools** with VNet injection sits in between: Microsoft runs the agents, but inside a subnet
of yours.
