# Lab 0 — Get connected · 15 minutes

Sign in, point `kubectl` at the training cluster, and land in your own namespace.

**Raise your hand during this lab if anything fails.** Not at 14:45, when Lab 2 has started.

---

## 1. Sign in

```bash
az login
```

A browser window opens. Sign in with your PTG account.

Set subscription id
```bash
export SUBSCRIPTION_ID="YOUR_SUBSCRIPTION_ID"
az account set --subscription $SUBSCRIPTION_ID
```

## 2. Point kubectl at the cluster

```bash
export RG="YOUR_RESOURCE_GROUP"
export CLUSTER="YOUR_AKS_CLUSTER"
az aks get-credentials --resource-group "$RG" --name "$CLUSTER"
```

```bash
kubectl get nodes
```

You should see the cluster's nodes, all `Ready`.


## 4. Create your own namespace

It is yours alone, and you already put its name in `$NAMESPACE`.

```bash
export NAMESPACE="YOUR_NAME_OR_OTHER_NAME_THAT_YOU_NEED"
```
```bash
kubectl create namespace "$NAMESPACE"
```

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

