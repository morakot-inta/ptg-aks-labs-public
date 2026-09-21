import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import { DefaultAzureCredential } from "@azure/identity";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";

const PORT = Number(process.env.PORT ?? 8080);
const SECRET_PATH = process.env.SECRET_PATH ?? "/mnt/secrets-store/db-password";
const ACCOUNT = process.env.STORAGE_ACCOUNT ?? "";
const CONTAINER = process.env.STORAGE_CONTAINER ?? "lab-data";
const WHO = process.env.NAMESPACE ?? process.env.HOSTNAME ?? "unknown";

type Result = { code: number; body: Record<string, unknown> };

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** A client that holds NO key. It holds a way to prove who this pod is. */
function container(): ContainerClient {
  if (!ACCOUNT) throw new Error("STORAGE_ACCOUNT is not set on the Deployment");
  const svc = new BlobServiceClient(
    `https://${ACCOUNT}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );
  return svc.getContainerClient(CONTAINER);
}

/** Turn the failures attendees actually hit into plain advice. */
function explain(err: unknown): string {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (/STORAGE_ACCOUNT is not set/.test(text))
    return "Add STORAGE_ACCOUNT to the env block of your Deployment. The value is on your card.";
  if (/CredentialUnavailable|AuthenticationError|No matching federated identity|AADSTS70021/i.test(text))
    return 'This pod has no identity. Check that azure.workload.identity/use: "true" is on the POD TEMPLATE, not just an annotation on the ServiceAccount.';
  if (/AuthorizationPermissionMismatch|403|Forbidden/i.test(text))
    return "The pod HAS an identity, but that identity is not allowed to touch this container. This is a role assignment problem, not a Kubernetes problem — /whoami will still succeed.";
  if (/ContainerNotFound|BlobNotFound|404/i.test(text))
    return `Not found in account '${ACCOUNT}', container '${CONTAINER}'.`;
  if (/Cannot find module|ERR_MODULE_NOT_FOUND/i.test(text))
    return "The Azure SDK is missing from the image. You should never see this in the lab — tell the trainer.";
  return "Read the error above before changing anything.";
}

function failed(err: unknown, extra: Record<string, unknown> = {}): Result {
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return { code: 500, body: { status: "failed", ...extra, error: text.slice(0, 400), hint: explain(err) } };
}

// ------------------------------------------------------------- handlers ---
async function secret(): Promise<Result> {
  if (!(await exists(SECRET_PATH)))
    return {
      code: 503,
      body: {
        status: "missing",
        path: SECRET_PATH,
        hint: "The CSI volume is not mounted. Check the volumes and volumeMounts blocks in your Deployment.",
      },
    };
  const value = (await readFile(SECRET_PATH, "utf8")).trim();
  return {
    code: 200,
    body: {
      status: "ok",
      path: SECRET_PATH,
      length: value.length,           // never return the secret itself
      note: "Read from a file on disk, not from an environment variable.",
    },
  };
}

/** Lab 4 step 1: did this pod get an identity? No storage involved. */
async function whoami(): Promise<Result> {
  try {
    const token = await new DefaultAzureCredential().getToken("https://storage.azure.com/.default");
    return {
      code: 200,
      body: {
        status: "ok",
        note: "Entra issued a token to this pod. No password was involved.",
        expiresOn: token?.expiresOnTimestamp ?? null,
        clientId: process.env.AZURE_CLIENT_ID ?? "(not set)",
        tokenFilePresent: await exists(process.env.AZURE_FEDERATED_TOKEN_FILE ?? "/nonexistent"),
      },
    };
  } catch (err) {
    return failed(err, { status: "no identity" });
  }
}

async function storageList(): Promise<Result> {
  try {
    const names: string[] = [];
    for await (const blob of container().listBlobsFlat()) names.push(blob.name);
    return { code: 200, body: { status: "ok", container: CONTAINER, count: names.length, blobs: names.slice(0, 50) } };
  } catch (err) {
    return failed(err);
  }
}

async function storageRead(q: URLSearchParams): Promise<Result> {
  const name = q.get("name") ?? "hello.txt";
  try {
    const buf = await container().getBlobClient(name).downloadToBuffer();
    return {
      code: 200,
      body: { status: "ok", blob: name, content: buf.toString("utf8").slice(0, 2000),
              note: "Downloaded with no access key and no SAS token." },
    };
  } catch (err) {
    return failed(err, { blob: name });
  }
}

async function storageWrite(q: URLSearchParams): Promise<Result> {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const name = q.get("name") ?? `${WHO}-${stamp}.txt`;
  const body = q.get("text") ?? `written by ${WHO} at ${stamp}`;
  try {
    await container().getBlockBlobClient(name).upload(body, Buffer.byteLength(body));
    return {
      code: 201,
      body: { status: "written", blob: name, bytes: body.length,
              note: `Uploaded with no access key and no SAS token. Read it back with /storage/read?name=${name}` },
    };
  } catch (err) {
    return failed(err, { blob: name });
  }
}

const ROUTES: Record<string, (q: URLSearchParams) => Promise<Result> | Result> = {
  "/": () => ({
    code: 200,
    body: {
      app: "orders-api",
      runtime: `node ${process.version}`,
      endpoints: ["/healthz", "/ready", "/secret", "/whoami", "/storage", "/storage/read", "/storage/write"],
      storageAccount: ACCOUNT || "(not set)",
      container: CONTAINER,
    },
  }),
  "/healthz": () => ({ code: 200, body: { status: "alive" } }),
  "/ready": () => ({ code: 200, body: { status: "ready" } }),
  "/secret": () => secret(),
  "/whoami": () => whoami(),
  "/storage": () => storageList(),
  "/storage/read": (q) => storageRead(q),
  "/storage/write": (q) => storageWrite(q),
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const handler = ROUTES[path];
  const { code, body } = handler
    ? await handler(url.searchParams)
    : { code: 404, body: { status: "not found", path } };
  console.log(`${req.method} ${url.pathname} -> ${code}`);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2) + "\n");
});

server.listen(PORT, () =>
  console.log(`orders-api listening on :${PORT}  account=${ACCOUNT || "(unset)"} container=${CONTAINER}`),
);
