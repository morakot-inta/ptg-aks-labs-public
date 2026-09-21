# Lab 3 — Mount a secret from Key Vault · 15 minutes

Short lab. The secret arrives as a **file**, not an environment variable — that is the part
that usually means a code change in your own application.

---

## 1. Create the SecretProviderClass

Edit `k8s/secretproviderclass.yaml` and fill in three values from your card —
`<KV-CLIENT-ID>`, `<KEY-VAULT>` and `<TENANT-ID>` — then:

```bash
kubectl apply -f k8s/secretproviderclass.yaml
```

> **`<KV-CLIENT-ID>`, not `<CLIENT-ID>`.** Your card has two client IDs and they are not
> interchangeable. This one belongs to the identity the Key Vault add-on attached to the
> cluster's nodes, because the thing fetching the secret is the CSI driver on the node, not
> your pod. The other one is your pod's, and it is Lab 4's. Getting them the wrong way
> round leaves the pod in `ContainerCreating` with `Identity not found` in its events.

## 2. Add a volume to your Deployment

Two blocks go into `k8s/deployment.yaml`, the file you deployed in Lab 2, **and they go in
two different places**. Missing the second one is the commonest mistake in this lab: the pod
starts perfectly and the secret simply is not there.

**ADD 1 — the volume, at `spec.template.spec.volumes`**

A sibling of `containers`, at the same indentation as it:

```yaml
spec:                       # ← Deployment spec
  template:
    spec:                   # ← pod spec
      volumes:              # ← ADD THIS BLOCK
      - name: secrets
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: orders-api-spc
      containers:           # ← already there
      - name: orders-api
```

**ADD 2 — the mount, at `spec.template.spec.containers[0].volumeMounts`**

Inside the container, alongside `ports` and `resources`:

```yaml
      containers:
      - name: orders-api
        image: ...          # already there
        volumeMounts:       # ← ADD THIS BLOCK
        - name: secrets
          mountPath: /mnt/secrets-store
          readOnly: true
```

`name: secrets` has to match in both — that is what joins the mount to the volume.

`lab3-secret/solution/deployment.yaml` has the exact indentation if you want to compare.

```bash
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deploy/orders-api
```

**Wait for that second command to finish.** Until it does, the old pods are still there and
still have no secret mounted — read one of those and you will think your YAML is wrong when
it is not.

## 3. Read it from inside the pod

```bash
POD=$(kubectl get pod -l app=orders-api --sort-by=.metadata.creationTimestamp -o name | tail -1)
kubectl exec $POD -- cat /mnt/secrets-store/db-password
```

The app also reports on it, without printing the value:

```bash
kubectl exec $POD -- curl -s localhost:8080/secret
```

Before the volume is mounted that returns `503` and tells you what is missing.

---

## Done when

The command above prints the secret value.

**Now ask yourself:** your own application reads its secrets from somewhere today. If it
reads an environment variable, this is a code change — not a big one, but a real one. That
is worth knowing now rather than during a migration.
