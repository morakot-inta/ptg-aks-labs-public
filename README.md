# PTG — AKS hands-on labs

Everything you need to copy and paste during the session. Five labs, one folder each.

**Session:** 14:00–17:00 · **Format:** hands-on · you work in your own namespace.

---

> **Not set up yet?** Read [PREREQUISITES.md](PREREQUISITES.md) first — tools, accounts
> and permissions, and how to check they work.

## Before you start: your six values

Your trainer gives you these on a card. In Lab 0 you save them to `~/aks-lab.env` and
`source` it — from then on every command in every lab uses the variable, so you never type
your own values into a command again:

```bash
export NAMESPACE="<your name>"
export RG="<resource group>"
export CLUSTER="<cluster>"
export ACR="<registry name, without .azurecr.io>"
export CLIENT_ID="<client id>"                # Lab 4
export KV_CLIENT_ID="<key vault add-on client id>"   # Lab 3
export STORAGE_ACCOUNT="<storage account>"    # Lab 4
```

> Variables belong to one shell. New tab, or a shell that timed out? `source ~/aks-lab.env`
> and carry on — that is what the file is for.

**The YAML files are the exception**, and deliberately so: there you edit the placeholder in
the file by hand, because changing the manifest *is* the lab. A shell variable will not be
expanded inside a `.yaml`.

| In a command | In a YAML file | |
|---|---|---|
| `$NAMESPACE` | `<NAMESPACE>` | your own namespace, usually your first name |
| `$RG` | `<RESOURCE-GROUP>` | |
| `$CLUSTER` | `<CLUSTER>` | |
| `$ACR` | `<ACR>` | the registry name, without `.azurecr.io` |
| — | `<ACR>.azurecr.io/orders-api:<NAMESPACE>` | the image you build in Lab 1 |
| `$CLIENT_ID` | `<CLIENT-ID>` | the managed identity **your pod** uses. Shared with the room — what makes it yours is a federated credential naming your namespace (Lab 4) |
| `$KV_CLIENT_ID` | `<KV-CLIENT-ID>` | the managed identity the Key Vault add-on attached to the **nodes**. Not the same as `CLIENT_ID` (Lab 3) |
| `$STORAGE_ACCOUNT` | `<STORAGE-ACCOUNT>` | the storage account, without `.blob.core.windows.net` (Lab 4) |

---

## The labs

| | Lab | Time | You finish when |
|---|---|---|---|
| 0 | [Get connected](lab0-connect/) | 15 min | `kubectl get pods` says *No resources found* |
| 1 | [Build your image into ACR](lab1-build/) | 15 min | your tag is listed in the registry |
| 2 | [Deploy it](lab2-deployment/) | 45 min | `kubectl get deploy` shows `READY 2/2` |
| 3 | [Mount a secret from Key Vault](lab3-secret/) | 15 min | you can `cat` the secret inside the pod |
| 4 | [Wire up Workload Identity](lab4-workload-identity/) | 45 min | you write a file to Azure Storage and read it back, with no key anywhere |

Plus two topics that are demonstrated rather than practised:
[publishing through the shared gateway](step5-publish/) and
[deploying from Azure Pipelines](step6-azure-pipelines/). The files are here either way, so
you can work through them afterwards.

Everything you edit and apply lives in [`k8s/`](k8s/) — one folder, and the same
`deployment.yaml` grows through Labs 2, 3 and 4 rather than being replaced. **Run the
commands from the root of this repository**, not from inside a lab folder:

```bash
kubectl apply -f k8s/deployment.yaml
```

The lab folders hold the instructions and a `solution/` to compare against. The application
itself is in [`sample-app/`](sample-app/) — one readable file, if you want to see what the
endpoints actually do.

Platform engineers: [`provision/`](provision/) builds the whole environment — copy and paste into Azure Cloud Shell.

---

## If you get stuck

Every lab has a `solution/` folder. **Try to finish without it** — in Lab 2 especially, being
refused by the cluster and working out why is the entire point of the exercise.

Raise a hand instead. The trainer is circulating.
