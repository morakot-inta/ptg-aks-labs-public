# Lab 5 — Publish the web app · 20 minutes

## 0. Enable Gateway API and Create Share Gateway
```bash
az aks update --resource-group $RG --name $CLUSTER --enable-gateway-api
```

```bash
kubectl create namespace gateway-system --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f - <<'YAML'
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: ptg-shared-gateway
  namespace: gateway-system
spec:
  gatewayClassName: istio
  listeners:
  - name: http
    port: 80
    protocol: HTTP
    hostname: "*.local"
    allowedRoutes:
      namespaces:
        from: All
  infrastructure:
    annotations:
      service.beta.kubernetes.io/azure-load-balancer-internal: "true"
YAML

kubectl -n gateway-system get gateway ptg-shared-gateway
```

## 1. A ClusterIP Service

```bash
kubectl apply -f k8s/service.yaml
```

## 2. An HTTPRoute

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

Get Gateway IP Address
```bash
GW=$(kubectl get gateway -n gateway-system -o jsonpath='{.items[*].status.addresses[*].value}{"\n"}')

POD=$(kubectl get pod -l app=orders-api --sort-by=.metadata.creationTimestamp -o name | tail -1)
kubectl exec $POD -- curl -s -i --resolve "order-api.local:80:$GW" http://order-api.local/healthz
```

---

## Done when

`curl` returns **HTTP 200** from your own service.

