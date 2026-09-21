# Lab 0 — Get connected · 15 minutes

Sign in, point `kubectl` at the training cluster, and land in your own namespace.

**Raise your hand during this lab if anything fails.** Not at 14:45, when Lab 2 has started.

---

## 1. Sign in

```bash
az login
```

A browser window opens. Sign in with your PTG account.

```bash
az account show --output table
```

The subscription name should be the training one. If it is not:

```bash
az account set --subscription "<SUBSCRIPTION-NAME>"
```

## 2. Set your values, once

Put the block from your card in a file rather than typing it at the prompt. It is the same
number of keystrokes now, and it saves you from retyping six values every time a shell goes
away. Open a new file in your editor — `code ~/aks-lab.env`, or `nano ~/aks-lab.env` —
**paste your card into it, and save**:

```bash
export NAMESPACE="<your name>"
export RG="<resource group>"
export CLUSTER="<cluster>"
export ACR="<registry name, without .azurecr.io>"
export CLIENT_ID="<client id>"                # Lab 4
export KV_CLIENT_ID="<key vault add-on client id>"   # Lab 3
export STORAGE_ACCOUNT="<storage account>"    # Lab 4
```

Then load it into this shell:

```bash
source ~/aks-lab.env
```

Check it took:

```bash
echo "$NAMESPACE @ $CLUSTER / $ACR"
```

Every command in every lab from here on reads these variables, so this is the only place
you type your own values into a command.

> **New tab, or a shell that timed out?** `source ~/aks-lab.env` and carry on. That one
> command is the whole reason for the file.

> **Why `export`?** Without it the variables belong to this shell alone and any script or
> tool you run from it cannot see them. With it they are inherited, which is what makes the
> file behave like a script rather than six things you typed once.

## 3. Point kubectl at the cluster

```bash
az aks get-credentials --resource-group "$RG" --name "$CLUSTER"
```

```bash
kubectl get nodes
```

You should see the cluster's nodes, all `Ready`.

> **Times out?** You are probably not on the corporate network. Connect to the VPN and try
> again.

## 4. Create your own namespace

It is yours alone, and you already put its name in `$NAMESPACE`.

```bash
kubectl create namespace "$NAMESPACE"
```

> **`forbidden`?** You are signed in as someone the platform team did not put on the
> attendee list. Raise your hand — this is exactly what Lab 0 is for.

On the real cluster this command will not be yours to run: namespaces are created by the
platform team, as part of onboarding an application. You run it once here so that a
namespace is a thing you have made, rather than a word on a slide.

## 5. Move into it

Otherwise every command for the rest of the afternoon needs `-n "$NAMESPACE"` on the end.

```bash
kubectl config set-context --current --namespace="$NAMESPACE"
```

---

## Done when

```bash
kubectl get pods
```

prints:

```
No resources found in <your namespace> namespace.
```

**An empty list is the correct answer.** It means you are connected, and pointed at a
namespace that is yours alone — nothing you do for the rest of the afternoon can affect
anyone else.
