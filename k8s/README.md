# k8s/ — your manifests

This folder is yours. Everything in it is something you edit and apply during the labs, and
it grows as the afternoon goes on rather than being replaced.

| File | Added in | What it is |
|---|---|---|
| `deployment.yaml` | Lab 2, then Lab 3 and Lab 4 add to it | your application |
| `secretproviderclass.yaml` | Lab 3 | which vault and which secret to fetch |
| `serviceaccount.yaml` | Lab 4 | the identity your pod runs as |
| `service.yaml`, `httproute.yaml` | Step 5 | how it is reached from outside |

Apply them from the **root of the repository**, one at a time, as each lab says:

```bash
kubectl apply -f k8s/deployment.yaml
```

The lab folders next to this one hold the instructions and the solutions. This folder holds
the thing you are actually building.

One more reason it is called `k8s/`: the pipeline in
[`step6-azure-pipelines/`](../step6-azure-pipelines/) deploys with

```bash
kubectl apply -f k8s/ -n $(NAMESPACE)
```

— the same folder, applied by a pipeline instead of by you.
