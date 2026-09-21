# Lab 4 — Wire up Workload Identity · 45 minutes

Your pod is going to read and write files in Azure Storage **with no access key, no
connection string and no SAS token** — none of which appear anywhere in your manifest or in
the application code.

The hardest lab, because **when you get it wrong nothing errors.** The pod starts normally
and only the storage call fails.

---

## 1. Create the ServiceAccount

Put your `<CLIENT-ID>` into `k8s/serviceaccount.yaml` — it is on your card, and it is in
`$CLIENT_ID` if you still have the shell from Lab 0. Type it into the file rather than
referring to the variable: YAML does not expand shell variables.

The same client ID is on everyone's card. It identifies one managed identity that the whole
room shares — what makes it *yours* is the federated credential the platform team created
naming **your** namespace and this ServiceAccount.

**This is a different identity from the one in Lab 3**, and the difference is the lesson.
Lab 3 read the vault with an identity bolted to the *node*: every pod on that node can use
it, yours included, and nothing about it knows which namespace asked. From here on the
identity is attached to *your pod*, through the ServiceAccount below — which is why Azure
can grant it access to your storage and nobody else's. Then:

```bash
kubectl apply -f k8s/serviceaccount.yaml
```

## 2. Three changes to your Deployment

Three changes, in three different places in `k8s/deployment.yaml`. The paths matter more
than the YAML does — two of these look like they belong somewhere they do not.

**A — at `spec.template.spec.serviceAccountName`**

Inside the pod spec, a sibling of `containers`:

```yaml
spec:
  template:
    spec:                                     # ← pod spec
      serviceAccountName: orders-api          # ← ADD
      securityContext:                        # already there
        runAsNonRoot: true
```

**B — at `spec.template.metadata.labels`**

On the **pod template's** metadata, not the Deployment's, and not on the ServiceAccount:

```yaml
spec:
  template:
    metadata:
      labels:
        app: orders-api                       # already there
        azure.workload.identity/use: "true"   # ← ADD
    spec:
      serviceAccountName: orders-api
```

This is the one almost everyone gets wrong. There is a `metadata:` at the top of the file
too, and putting the label there does nothing at all — no error, no warning, and no
identity.

**C — at `spec.template.spec.containers[0].env`**

Inside the container, alongside `ports` and `volumeMounts`:

```yaml
      containers:
      - name: orders-api
        image: ...                            # already there
        env:                                  # ← ADD
        - name: STORAGE_ACCOUNT
          value: "<STORAGE-ACCOUNT>"
        - name: NAMESPACE
          value: "<NAMESPACE>"
```

```bash
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deploy/orders-api
```

**Wait for the rollout.** A pod that started before your change has no identity, and every
endpoint below will lie to you about why.

## 3. Work through it in order

Three endpoints, on purpose — each one rules out a different problem.

```bash
POD=$(kubectl get pod -l app=orders-api --sort-by=.metadata.creationTimestamp -o name | tail -1)

# a) does this pod have an identity at all? (no storage involved)
kubectl exec $POD -- curl -s localhost:8080/whoami

# b) can that identity SEE the container?
kubectl exec $POD -- curl -s localhost:8080/storage

# c) can it READ a file?
kubectl exec $POD -- curl -s localhost:8080/storage/read?name=hello.txt

# d) can it WRITE one?
kubectl exec $POD -- curl -s -X POST localhost:8080/storage/write
```

Step (d) prints the name of the file it created. Read it back:

```bash
kubectl exec $POD -- curl -s "localhost:8080/storage/read?name=<the-name-it-printed>"
```

---

## Done when

You have **written a file and read it back**, and there is no key, no connection string and
no SAS token anywhere in your Deployment.

Look at the manifest you just applied. The only thing in it that relates to Azure is a
client ID — which is not a secret, and is safe to commit.

---

## When it does not work

The three endpoints separate the two failures that look identical from the outside:

| What you see | What it means | Fix |
|---|---|---|
| `/whoami` fails | The pod has **no identity** | The pod-template label. Nine times out of ten this is it — the annotation on the ServiceAccount feels like it should be enough, and it is not |
| `/whoami` works but `/storage` returns 403 | The pod **has** an identity, but it is not allowed to touch the container | A role assignment problem, not a Kubernetes one. Tell the trainer |
| `STORAGE_ACCOUNT is not set` | Change **C** is missing | Add the `env` block |

```bash
# the label must be on the POD, not just the Deployment
kubectl get pod -l app=orders-api -o jsonpath='{.items[0].metadata.labels}' | tr ',' '\n'

# the projected token only exists if the label is set
kubectl exec $POD -- ls /var/run/secrets/azure/tokens/
```
