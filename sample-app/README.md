# orders-api — the sample application

TypeScript on Node. One file, two Azure SDK packages, no web framework and no build step —
Node runs the `.ts` file directly and strips the types. You are meant to be able to read all
of it.

| Endpoint | Used in | Behaviour |
|---|---|---|
| `/healthz` | Lab 2 | Always 200 — the liveness probe |
| `/ready` | Lab 2 | Always 200 — the readiness probe |
| `/secret` | Lab 3 | 200 once the Key Vault secret is mounted, 503 with a hint before that. Reports the length, never the value |
| `/whoami` | Lab 4 | Did the pod get an identity at all? No storage involved, so it isolates the first failure |
| `/storage` | Lab 4 | Lists the container. 403 here means the identity works but has no role assignment |
| `/storage/read` | Lab 4 | Downloads a file |
| `/storage/write` | Lab 4 | Uploads one. `GET` or `POST`, whichever is easier to type |

## Five deliberate design choices

**`/ready` does not check the secret or storage.** Lab 2 happens before either is wired up.
If readiness depended on them, the Lab 2 Deployment would never reach `2/2` and the lab
would be unfinishable.

**Three storage endpoints, not one.** `/whoami` fails when the pod has no identity;
`/storage` fails when it has one but no role assignment. From the outside those two look
identical, and separating them is what makes the lab debuggable in 20 minutes.

**No key, anywhere.** There is no access key, connection string or SAS token in the code or
in any manifest. `DefaultAzureCredential` is handed to the SDK and Azure decides the rest.

**`curl` is installed in the image.** Step 5 verifies the published route from inside the
cluster, and shipping `curl` with the application avoids pulling and cleaning up a second,
throwaway image just to make one HTTP call.

**No build step, and no `dist/`.** Node 22.18 and later run a `.ts` file by stripping the
type annotations, so the image copies `index.ts` and runs it. `npm run typecheck` still runs
the real compiler when you want the types checked — it just never has to run to deploy.

## Build and push

Attendees do this in Lab 1, tagged with their own namespace:

```bash
az acr build --registry <ACR> --image orders-api:<NAMESPACE> .
```

The platform team builds `orders-api:v1` the same way before the session, as the fallback
for anyone whose build fails.

Either way the build happens inside ACR, so nothing is built on the machine running the
command and nobody needs Docker.

## Run it locally

```bash
npm install
npm start
curl localhost:8080/healthz
```

Azure Cloud Shell has Node 24 and npm already, which is enough for both.

The storage endpoints need `STORAGE_ACCOUNT` set and an `az login` first. `/whoami` will
succeed locally using your Azure CLI sign-in — in the cluster the same code path uses the
pod's federated token instead, which is the point.
