# Lab 1 — Build your image into ACR · 15 minutes

## 0. if ACR have not created yet, pls create ACR via this cli
```bash
export ACR=""
```
```
az acr create \
  --resource-group $RG \
  --name $ACR \
  --sku Basic
```
after then attach the acr to aks
```
az aks update --resource-group $RG --name $CLUSTER --attach-acr $ACR
```

## 1. Build and push, in one command


```bash
az acr build --registry "$ACR" --image "orders-api:$NAMESPACE" sample-app/
```

## 2. Look at what you just pushed

```bash
az acr repository show-tags --name "$ACR" --repository orders-api --output table
```

Your tag is in the list, alongside everyone else's.


