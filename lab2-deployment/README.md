# Lab 2 — Deploy it · 45 minutes

Deploy the image you built in Lab 1, onto the cluster, into your own namespace.

`k8s/deployment.yaml` is a normal Deployment. **One line is yours to change** — the image.

> **Run everything from the root of the repository**, not from this folder. `k8s/` is yours:
> it holds the manifests you edit and apply all afternoon, and Labs 3 and 4 add to the same
> `deployment.yaml` rather than starting a new one. This folder holds the instructions.

---

## 1. Put your image in the manifest

Open `k8s/deployment.yaml` and replace the two placeholders at
`spec.template.spec.containers[0].image`:

```yaml
      containers:
      - name: orders-api
        image: <ACR>.azurecr.io/orders-api:<NAMESPACE>    # ← this line
        ports:
        - containerPort: 8080
```

## 2. Apply it

```bash
kubectl apply -f k8s/deployment.yaml
```

## 3. Watch it come up

```bash
kubectl get deploy orders-api -w
```

`Ctrl-C` when it reaches `2/2`.

---

## Done when

```bash
kubectl get deploy orders-api
```

shows:

```
NAME         READY   UP-TO-DATE   AVAILABLE
orders-api   2/2     2            2
```

---

## If the pods do not start

`kubectl get pod` shows a status, and the reason is in the events — not in the logs. A
container that never started has no logs to read:

```bash
kubectl describe pod -l app=orders-api
```

```bash
kubectl logs deploy/orders-api
```
