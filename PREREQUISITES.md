# AKS hands-on labs — prerequisites

Everything that must be true before 14:00 on the day. Three parts: what each attendee does,
what PTG's platform team builds, and three decisions that are still open.

---

# Part A · Each attendee, on their own laptop

## A1 · Tools

| Tool | Needed for | Install |
|---|---|---|
| **Azure CLI** (`az`) 2.60+ | Every lab | Windows `winget install Microsoft.AzureCLI` · macOS `brew install azure-cli` |
| **kubectl** | Every lab | `az aks install-cli` (after the Azure CLI) |
| **A text editor** | Labs 2–4 | VS Code, or whatever you use for YAML |
| **git** | Getting the lab files | Already on most machines. Alternative: download the repo as a ZIP |
| `jq` | One command in Step 5 | **Optional.** Without it the same check works, just less readable |

**Docker is NOT required, even though Lab 1 builds an image.** `az acr build` uploads the
folder and the registry does the build, so nothing runs on your machine. This is deliberate:
Docker Desktop is the tool most often blocked on a corporate laptop, and the one with
licensing conditions.

> **If your laptop blocks software installation, say so now.** There is a browser-based
> alternative but it has to be arranged in advance.

## A2 · Accounts

| Account | Needed for | Notes |
|---|---|---|
| **Microsoft Entra account in PTG's tenant** | Every lab | The one you already sign into Azure with |
| **Azure DevOps account in PTG's organisation** | Getting the lab files | Only if we distribute by repository — see Decision 1 |

## A3 · Azure permissions on your account

| Permission | Why |
|---|---|
| **Reader** on the training subscription | So `az account show` and the portal work |
| **Azure Kubernetes Service Cluster User Role** on the training cluster | This is what makes `az aks get-credentials` work. Without it, Lab 0 stops dead |
| Kubernetes **edit** rights **in your own namespace only** | Labs 2–4. Not cluster-wide — you should not be able to touch anyone else's namespace |
| **Container Registry Tasks Contributor** + **AcrPull** on the training registry | Lab 1 queues a build with `az acr build`. Not `AcrPush` — that role is data-plane only (`pull/read`, `push/write`) and cannot schedule a task run |

## A4 · Network

| | |
|---|---|
| Reach the cluster's API server | Corporate network or VPN — see Decision 2 |
| Outbound HTTPS (443) to `login.microsoftonline.com`, `management.azure.com`, `*.azmk8s.io` | Sign-in and every `kubectl` call |

## A5 · Prove it before the day

Run these. All must succeed.

```bash
az --version
kubectl version --client
az login
az account show
az aks get-credentials --resource-group <RG> --name <CLUSTER>
kubectl get nodes
```

**Send us the error if any of them fail.** Fixing installations on the day comes out of lab
time, and three hours has no slack in it.

---

# Part B · The platform team, before the day

Every command for this is in [`provision/`](../aks-labs/provision/),
written to be pasted into Azure Cloud Shell in order. What follows is what that runbook does
and why each part matters.

## B1 · The cluster itself

Four flags matter. Getting them wrong means rebuilding, so check before creating.

| Flag | Why |
|---|---|
| `--enable-oidc-issuer --enable-workload-identity` | Lab 4 does not exist without these |
| `--network-plugin azure --network-plugin-mode overlay` | The labs teach that pod addresses do not consume VNet space. On a non-overlay cluster that statement is false |
| `--enable-aad --enable-azure-rbac` | **Easy to miss.** Without Entra integration, a RoleBinding against an Entra object ID authorises nobody, so attendees cannot be confined to their own namespace |
| **Public API server** — `privateCluster: false`, restricted with `--api-server-authorized-ip-ranges` | Attendees connect from their own laptops. **A private cluster cannot be used for this session.** This is a deliberate, documented difference from the production design, which requires a private API server — the deck names the exception out loud so attendees do not build the wrong mental model |

Restrict it rather than leaving it open to the internet — one command, no downside:

```bash
az aks update -g $RG -n $CLUSTER \
  --api-server-authorized-ip-ranges "<office egress IP>/32"
```

Check an existing cluster:

```bash
az aks show -g $RG -n $CLUSTER --query '{oidc:oidcIssuerProfile.enabled,
  workloadIdentity:securityProfile.workloadIdentity.enabled,
  overlay:networkProfile.networkPluginMode, entra:aadProfile.managed,
  private:apiServerAccessProfile.enablePrivateCluster}'
```

## B2 · Features to enable on it

| # | What | Command | For |
|---|---|---|---|
| 1 | Istio add-on, revision **`asm-1-26` or later** | `az aks mesh enable -g $RG -n $CLUSTER` | Step 5 |
| 2 | **Managed Gateway API** | `az aks update -g $RG -n $CLUSTER --enable-gateway-api` | Step 5. **Needs `azure-cli` 2.86.0+** — `az upgrade`, or `brew upgrade azure-cli` on a Homebrew install |
| 3 | Azure Policy add-on | `az aks enable-addons -g $RG -n $CLUSTER --addons azure-policy` | Lab 2 |
| 4 | Secrets Store CSI driver | `az aks enable-addons -g $RG -n $CLUSTER --addons azure-keyvault-secrets-provider` | Lab 3. Runbook step 2 enables it alongside `azure-policy`; step 1's shape check now reports whether it is on |
| 5 | ACR attached | `az aks update -g $RG -n $CLUSTER --attach-acr $ACR` | Every lab — this is what removes the `imagePullSecret` |

Runbook steps 2 and 3.

Verify 1 and 2 landed:

```bash
kubectl get gatewayclass          # expect "istio" with ACCEPTED=True
```

## B3 · The four policies Lab 2 depends on

The add-on alone enforces nothing. Assign these as **`deny`**, scoped to the resource group:

| Policy | Catches |
|---|---|
| `Kubernetes cluster containers should only use allowed images` | an image that is not from your ACR |
| `Kubernetes cluster containers CPU and memory resource limits should not exceed the specified limits` | missing or excessive limits |
| `Kubernetes cluster pods and containers should only run with approved user and group IDs` | running as root |
| `Ensure cluster containers have readiness or liveness probes configured` | missing probes |

Runbook step 3 assigns all four with the right parameters.

> **Gatekeeper syncs on a schedule — allow 15 to 20 minutes** before the rules reject
> anything. Verifying immediately gives a false failure.

## B4 · Supporting resources

| # | What | For |
|---|---|---|
| 1 | **ACR** with `orders-api:v1` — `az acr build --registry $ACR --image orders-api:v1 sample-app/` | Every lab |
| 2 | **Key Vault** with a secret `db-password`, RBAC authorisation on, and **`Key Vault Secrets User` granted to the Key Vault add-on's own identity** | Lab 3. The add-on creates `azurekeyvaultsecretsprovider-<cluster>` in the `MC_` group and attaches it to the node pool — that is what the CSI driver authenticates as, not `id-aks-lab` |
| 3 | **Storage account**, container `lab-data`, one file `hello.txt` | Lab 4 |
| 4 | One shared **Gateway**, internal, in `gateway-system` | Step 5 |

Runbook steps 4, 5 and 7.

## B5 · Per attendee

| # | What | Note |
|---|---|---|
| 1 | A **custom role**, `AKS Lab Namespace Creator`, assigned at cluster scope | Attendees create their own namespace in Lab 0. No built-in role allows it — RBAC Writer grants `namespaces/read` only, RBAC Admin excludes `namespaces/write`, and Cluster Admin gives away the cluster. Creating the role definition needs **Owner** or **User Access Administrator** |
| 2 | A **federated credential** on a managed identity, subject `system:serviceaccount:<ns>:orders-api` | One identity holds **at most 20**, so more than 20 attendees needs a second. Create them **sequentially** — concurrently under one identity returns 409 — and **at least an hour ahead**, or a token request fails with `AADSTS70021` while it propagates |
| 3 | **Azure Kubernetes Service Cluster User Role** on the cluster | Without it `az aks get-credentials` fails and Lab 0 stops dead |
| 4 | **Azure Kubernetes Service RBAC Writer**, scoped to `<cluster-id>/namespaces/<ns>` | Requires B1's `--enable-aad --enable-azure-rbac`. The scope is an Azure string, so it is assigned before the attendee creates the namespace |
| 5 | **Container Registry Tasks Contributor** + **AcrPull** on the registry | Lab 1 has each attendee build `orders-api:<their namespace>`. `AcrPush` is the wrong role and will fail — `az acr build` schedules a task run, which is control plane, and AcrPush grants only `pull/read` and `push/write`. One tag each: twenty people pushing `:v1` would overwrite one another |
| 6 | A printed **card**: namespace, resource group, cluster, ACR, **their image reference**, **both client IDs**, key vault, tenant ID, storage account | Every lab refers to these placeholders. **The namespace name is not theirs to invent** — the federated credential names it, the image is tagged with it, and so is Step 5's hostname |

Items 1 to 5 are runbook step 8; item 6 is step 10.

The managed identity needs **Storage Blob Data Contributor** on the container (Contributor,
not Reader — Lab 4 uploads as well as downloads) and **Key Vault Secrets User** on the vault.

## B6 · Rehearse Lab 1 at the size you will run it

Microsoft publishes **no concurrent-run limit for ACR Tasks per registry SKU**, and no
documented behaviour for what happens past one — the CLI output implies runs queue, but
nothing states a ceiling. Twenty-five people running `az acr build` inside the same minute
is therefore untested ground that cannot be looked up.

Run it at the real size a few days ahead: ask five colleagues to fire the Lab 1 command at
once, and time it. If builds queue longer than the 15-minute slot, the options are to have
half the room start with Lab 2's manifest while the other half builds, or to fall back to
the `orders-api:v1` image from runbook step 4. Dedicated agent pools would be the documented
fix, but they are Premium-only and still in preview.

## B7 · Prove it, do not assume it

Runbook step 9 applies the deliberately broken Lab 2 manifest. **If that manifest is accepted, the
policies are not in force and Lab 2 has no lesson left in it** — which is invisible to any
check that only lists resources.

---

# Part C · Three decisions still open

### Decision 1 · How attendees get the lab files

The repository is private. Options: add each attendee to the Azure DevOps project (they need
an account in PTG's organisation), move it to a project the whole team already has, or hand
out a ZIP on the day and skip Azure Repos entirely for the labs.

### Decision 2 · How laptops reach the API server

A private API server, which the landing zone design requires for real clusters, **cannot be
reached from a laptop**. For the training cluster, either give it a public API server with
authorised IP ranges limited to PTG's offices, or require every attendee to be on the
corporate network. This has to be settled before the cluster is built.

### Decision 3 · ~~How Step 5 is verified~~ — closed

The obvious approach, a throwaway `curl` pod, is blocked by the allowed-images policy from
Lab 2. Resolved by installing `curl` in the sample image, so Step 5 verifies from the
attendee's own pod and no jump box is needed.
