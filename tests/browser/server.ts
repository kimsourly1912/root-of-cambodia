// Test-only loopback bridge to the actual built Worker. Never part of the bundle.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { createTestHarness } from "wrangler";
const origin = "http://127.0.0.1:8787";
const harness = createTestHarness({
  workers: [
    {
      configPath: "apps/web/wrangler.jsonc",
      secrets: { BETTER_AUTH_SECRET: randomBytes(32).toString("hex") },
    },
  ],
});
await harness.listen();
const worker = harness.getWorker<CloudflareEnv>();
await worker.applyD1Migrations("DB");
const db = (await worker.getEnv()).DB;
await db
  .prepare(
    "CREATE TABLE local_email(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,kind TEXT NOT NULL,url TEXT NOT NULL)",
  )
  .run();
const clients = new Map<string, string>();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", origin);
    if (url.pathname === "/__test/ready") {
      res.writeHead(200);
      res.end("ready");
      return;
    }
    // This capture reader exists only in the test process, never a product API.
    if (url.pathname === "/__test/mail" && req.method === "GET") {
      const row = await db
        .prepare(
          "SELECT url FROM local_email WHERE recipient=? AND kind=? ORDER BY rowid DESC LIMIT 1",
        )
        .bind(
          url.searchParams.get("email") ?? "",
          url.searchParams.get("kind") ?? "verify",
        )
        .first<{ url: string }>();
      res.writeHead(row ? 200 : 404, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(row ?? {}));
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    // Explicit fixture provisioning, solely in this loopback test process.
    if (url.pathname === "/__test/pilot-reviewer" && req.method === "POST") {
      if (size > 32768) {
        res.writeHead(413);
        res.end();
        return;
      }
      const input = JSON.parse(Buffer.concat(chunks).toString()) as {
        userId?: unknown;
        termsVersion?: unknown;
        termsDocument?: unknown;
      };
      if (
        typeof input.userId !== "string" ||
        (input.termsVersion !== null &&
          input.termsVersion !== "browser-approved-v1")
      ) {
        res.writeHead(422);
        res.end();
        return;
      }
      const result = await db
        .prepare(
          `INSERT INTO pilot_publication_config(singleton,reviewer_user_id,terms_version)
        SELECT 1,?,? WHERE EXISTS(SELECT 1 FROM user WHERE id=? AND emailVerified=1)
        ON CONFLICT(singleton) DO UPDATE SET reviewer_user_id=excluded.reviewer_user_id,terms_version=excluded.terms_version,revision=pilot_publication_config.revision+1`,
        )
        .bind(input.userId, input.termsVersion, input.userId)
        .run();
      if (
        result.meta.changes === 1 &&
        input.termsDocument === true &&
        input.termsVersion === "browser-approved-v1"
      )
        await db
          .prepare(
            "INSERT INTO booking_terms_document(version,content) VALUES ('browser-approved-v1','Synthetic browser-test terms only. Pay at the property.') ON CONFLICT(version) DO NOTHING",
          )
          .run();
      res.writeHead(result.meta.changes === 1 ? 200 : 422, {
        "Cache-Control": "no-store",
      });
      res.end();
      return;
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (key !== "host" && key !== "connection" && value !== undefined)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    const client = headers.get("X-Test-Client") ?? "default";
    if (!clients.has(client))
      clients.set(client, "192.0.2." + (80 + clients.size));
    headers.delete("X-Test-Client");
    headers.set("CF-Connecting-IP", clients.get(client)!);
    const response = await harness.fetch(url.href, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method ?? "GET")
        ? undefined
        : Buffer.concat(chunks),
      redirect: "manual",
    });
    for (const [key, value] of response.headers)
      if (
        ![
          "set-cookie",
          "content-length",
          "content-encoding",
          "transfer-encoding",
        ].includes(key)
      )
        res.setHeader(key, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    res.writeHead(response.status);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(503);
    res.end("Test bridge temporarily unavailable");
  }
});
server.listen(8787, "127.0.0.1");
async function stop() {
  server.close();
  await harness.close();
  process.exit(0);
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
