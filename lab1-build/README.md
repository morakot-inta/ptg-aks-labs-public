# Lab 1 — Build your image into ACR · 15 minutes

Every lab after this one deploys **the image you are about to build**, not one we prepared
for you. Nothing is built on your laptop: `az acr build` uploads the folder and the registry
does the work, so no Docker, no daemon, no base images pulled over the corporate link.

---

## 1. Build and push, in one command

From the root of this repository, using the variables you set in Lab 0:

```bash
az acr build --registry "$ACR" --image "orders-api:$NAMESPACE" sample-app/
```

**Tag it with your namespace**, not with `v1` — twenty people are pushing to the same
registry this afternoon and the tag is what keeps your image yours.

> **`$ACR` or `$NAMESPACE` empty?** You are in a different shell from the one you loaded
> them in. `source ~/aks-lab.env` and run it again.

You will see the Dockerfile run: Alpine, `npm ci`, the source copied in, a non-root user
created. It ends with `Run ID: caXX was successful after ...`.

## 2. Look at what you just pushed

```bash
az acr repository show-tags --name "$ACR" --repository orders-api --output table
```

Your tag is in the list, alongside everyone else's.

---

## Done when

```bash
az acr repository show --name "$ACR" --image "orders-api:$NAMESPACE" --output table
```

returns a row instead of an error. Now print the full reference and write it on your card,
because Lab 2 wants it typed into a YAML file, where variables do not work:

```bash
echo "$(az acr show -n "$ACR" --query loginServer -o tsv)/orders-api:$NAMESPACE"
```

---

## Two things worth noticing

**You never pushed anything.** There is no `docker login` here and no registry password
anywhere — `az acr build` used the Azure sign-in you already had from Lab 0 to *queue a
build*, and the registry built the image and pushed it on your behalf. Your account can
start a build and read the tag list. It cannot push an image directly, which is a smaller
permission than it looks like you were given.

**The cluster will pull this without credentials either.** The platform team attached the
registry to the cluster once, so the kubelet authenticates with its own managed identity.
That is why no manifest in this repository contains an `imagePullSecret`.

> **Build failed?** Tell the trainer, then carry on with
> `<ACR>.azurecr.io/orders-api:v1` — an image the platform team built before the session.
> Everything from Lab 2 onwards works the same way with it.
