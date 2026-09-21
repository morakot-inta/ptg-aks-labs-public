# Step 5 — Publish it

Demonstrated in the session rather than practised — but these are the files, ready to apply
in your own time.

The Gateway already exists. **You attach a route to it — you do not create one.** That split
is the whole point: the platform team owns the Gateway, your team owns the HTTPRoute.

---

## 1. A ClusterIP Service

```bash
kubectl apply -f k8s/service.yaml
```

Note the type: `ClusterIP`. A Service of type `LoadBalancer` asking for a public address is
refused by policy — nothing you deploy gets its own public address.

## 2. An HTTPRoute

Edit one line in `k8s/httproute.yaml`, at `spec.hostnames[0]`:

```yaml
spec:
  parentRefs:                       # already there — the shared gateway
  - name: ptg-shared-gateway
    namespace: gateway-system
  hostnames:
  - "<NAMESPACE>.lab.ptg.local"     # ← this line
```

```bash
kubectl apply -f k8s/httproute.yaml
```

## 3. Did it attach?

```bash
kubectl get httproute orders-api -o jsonpath='{.status.parents[0].conditions}' | jq
```

Look for `"type": "Accepted"` and `"status": "True"`.

## 4. Call it

From inside your own pod — `curl` is in the image, so nothing extra is pulled:

```bash
POD=$(kubectl get pod -l app=orders-api --sort-by=.metadata.creationTimestamp -o name | tail -1)
kubectl exec $POD -- curl -s -i "http://$NAMESPACE.lab.ptg.local/healthz"
```

> Why not `kubectl run` a curl image? Because the allowed-images policy from Lab 2 would
> refuse it — it only permits images from ACR. Your own pod already has what you need.

---

## Done when

`curl` returns **HTTP 200** from your own service.

---

## When it does not attach

| What the status says | Usually means |
|---|---|
| `NoMatchingListenerHostname` | your hostname does not match the pattern the shared Gateway listens for — check the spelling of your namespace |
| `BackendNotFound` | the `backendRefs` name does not match a Service in **your** namespace |
| nothing at all in `status` | the `parentRefs` name or namespace is wrong, so the Gateway never saw your route |
