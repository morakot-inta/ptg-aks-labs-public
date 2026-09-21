# Deploying from Azure Pipelines

Demonstrated in the session rather than practised — but this is the file, ready to copy.

## The one thing worth noticing

```yaml
  - task: AzureCLI@2
    inputs:
      azureSubscription: ptg-aks-wif   # workload identity federation
```

That service connection is the same mechanism you wired up in **Lab 4**. A workload proves
who it is and is handed a short-lived token, so no password or service-principal secret is
stored anywhere. In Lab 4 the workload was a pod; here it is a pipeline run. Same idea twice.

The value of `azureSubscription` is the service connection's **name**, not a subscription id.
Rename the connection and every pipeline referring to it breaks.

## Creating that connection by hand

Azure DevOps offers to create it automatically, and the offer costs more than it looks: the
person clicking it needs **Owner on the subscription**. That is more than a team confined to
its own resource groups should ever hold. Created manually against an identity the platform
team already owns, nobody needs Owner at all.

Three steps, and **the order is not negotiable**:

1. **Platform team creates a user-assigned managed identity.** Not an app registration — a
   tenant that blocks app registration creation is the normal case, and a managed identity
   sidesteps that Entra permission entirely.
2. **You create the service connection.** Type *Azure Resource Manager*, authentication
   *Workload identity federation (manual)*. There is no field for a secret; that is the
   point. It saves as a **draft** and hands you an **Issuer** and a **Subject identifier**.
3. **Platform team adds the federated credential** to that identity — scenario *Other
   issuer*, type *Explicit subject identifier* — pasting both values. Then *Finish setup* →
   *Verify and save*.

Step 3 cannot happen before step 2. The subject identifier contains the service connection's
own id, which does not exist until the connection does. Delete and recreate the connection
and that id changes, and the federated credential stops matching without anyone touching it.

Copy the subject identifier. Never retype it.

### Who needs which permission

The two sides are separate systems, and a person who can edit the connection in Azure DevOps
still cannot add the credential in Azure.

| Where | Permission |
|---|---|
| Azure DevOps | **Creator** or **Administrator** on service connections, at *Project settings > Pipelines > Service connections > Security*. Whoever creates one becomes its Administrator |
| The managed identity | **Managed Identity Contributor**, to add a federated credential |
| The target resources | whoever assigns the roles below needs `Microsoft.Authorization/roleAssignments/write` — Owner, User Access Administrator or Role Based Access Control Administrator |

### The roles the identity itself ends up holding

| Role | Scope |
|---|---|
| Reader | the subscription — *Verify* reads the subscription, and nothing else grants that |
| AcrPush | the registry |
| Azure Kubernetes Service Cluster User Role | the cluster — enough for `get-credentials`, not enough for `kubectl` |
| Azure Kubernetes Service RBAC Writer | `.../managedClusters/<cluster>/namespaces/<ns>` — one namespace, not the cluster |

A namespace-scoped assignment cannot be made in the portal; the cluster's IAM blade offers no
scope below the cluster. Use `az role assignment create --scope` with the identity's **object
id**. The client id goes in the service connection and nowhere near a role assignment — they
sit next to each other on the same portal blade and look identical.

## The line people forget

The cluster uses Microsoft Entra ID with Azure RBAC — the same thing that confines you to
your own namespace in Lab 0. That means `az aks get-credentials` on its own is not enough
from a pipeline:

```bash
kubelogin convert-kubeconfig -l azurepipelines
```

Without it, `kubectl` hangs waiting for a sign-in that will never come. The `azurepipelines`
mode reuses the service connection, so there is still nothing to store.

## Prove it with four lines before trusting the YAML

```yaml
  - task: AzureCLI@2
    inputs:
      azureSubscription: ptg-aks-wif
      scriptType: bash
      scriptLocation: inlineScript
      inlineScript: |
        az account show -o table
        az aks get-credentials -g $(RG) -n $(CLUSTER) --overwrite-existing
        kubelogin convert-kubeconfig -l azurepipelines
        kubectl get pods -n $(NAMESPACE)
```

Each line fails differently, which is the only reason to run them separately.

## When the token is refused

The first of these is authentication, the second is authorization, and getting the second
means the first already worked.

| What the pipeline prints | What it means | Fix |
|---|---|---|
| `AADSTS700213: No matching federated identity record found for presented assertion subject` | Entra holds no federated credential whose subject matches the assertion | The error prints the subject it presented — put exactly that on the identity. A subject beginning `/eid1/` pairs only with the issuer `https://login.microsoftonline.com/<tenant-id>/v2.0`, and the audience must be `api://AzureADTokenExchange` |
| `AuthorizationFailed` on `Microsoft.Resources/subscriptions/read` | Federation worked; the identity holds no role | Reader on the subscription. Then wait two minutes — role assignments propagate, and retrying at once shows the same error |
| `az account show` works, `kubectl` hangs | `kubelogin convert-kubeconfig` is missing | above |
| `kubectl` returns 403 | Cluster User Role granted, Kubernetes RBAC not | the namespace-scoped RBAC Writer assignment |

If assigning Reader on the subscription is refused by whoever owns it, roles at resource
group scope still let every task in the pipeline run — but *Verify* fails permanently, since
it reads the subscription and nothing else. Save without verifying and prove it with the four
lines above instead.

## Converting an old one

If your project still has a service connection created the old way — with a client secret —
that is the one thing worth changing. In the service connection's settings, **Convert** it to
workload identity federation.

Two limits the button does not mention. It only works on connections **Azure DevOps created
itself**, because it will not modify credentials on an identity it does not own — so a
connection built manually against your own managed identity, which is what this page
recommends, cannot be converted. And it only works while a **single project** uses the
connection; shared ones have to be replaced. A conversion can be reverted for seven days.

Two dates worth knowing. The old issuer `https://vstoken.dev.azure.com` retires on **1 July
2027**; anything created now already defaults to the Entra issuer, so this is a problem for
existing connections only. And a connection left unused for **100 days** is disabled
automatically, which catches pipelines that deploy rarely.

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
