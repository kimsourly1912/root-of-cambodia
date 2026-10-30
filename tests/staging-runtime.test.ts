import { test } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createTestHarness } from "wrangler";
import { runtimePolicy, stagingAuthRead } from "../apps/web/src/runtime-policy";

const origin = "https://staging.rootsofcambodia.com";
const baseURL = "http://127.0.0.1:8787";

test("runtime admission refuses remote capture, unknown modes and deceptive staging origins", () => {
  assert.equal(runtimePolicy("local", "http://127.0.0.1:8787").readOnly, false);
  assert.equal(runtimePolicy("staging-read-only", origin).readOnly, true);
  for (const [mode, url] of [
    ["local", origin], ["production", origin], ["staging", origin],
    ["staging-read-only", "http://127.0.0.1:8787"],
    ["staging-read-only", origin + ".evil.invalid"],
    ["staging-read-only", origin + "/path"],
    ["staging-read-only", "http://staging.rootsofcambodia.com"],
  ]) assert.throws(() => runtimePolicy(mode, url));
  assert.equal(stagingAuthRead(new Request(origin + "/api/auth/get-session")), true);
  for (const path of ["verify-email", "get-session/", "%67et-session", "sign-up/email"])
    assert.equal(stagingAuthRead(new Request(origin + "/api/auth/" + path)), false);
  assert.equal(stagingAuthRead(new Request(origin + "/api/auth/get-session", { method: "POST" })), false);
});

test("built staging Worker browses D1 but refuses auth, business writes and media uploads without side effects", async () => {
  const server = createTestHarness({ workers: [{
    configPath: "apps/web/wrangler.jsonc",
    env: "staging",
    secrets: { BETTER_AUTH_SECRET: randomBytes(32).toString("hex") },
  }] });
  try {
    await server.listen();
    const worker = server.getWorker<CloudflareEnv>();
    await worker.applyD1Migrations("DB"); // Isolated local harness only.
    const env = await worker.getEnv(), db = env.DB;
    assert.equal(env.APP_MODE, "staging-read-only");
    assert.equal(env.IMAGES, undefined);
    assert.equal("EMAIL" in env, false);
    const counts = async () => {
      const result: Record<string, number> = {};
      for (const table of ["user", "session", "account", "verification", "rateLimit", "place", "booking", "operation", "notification_outbox", "delivery_attempt", "property_media"])
        result[table] = (await db.prepare(`SELECT count(*) n FROM "${table}"`).first<{n: number}>())!.n;
      return result;
    };
    const before = await counts();
    const home = await server.fetch(baseURL);
    assert.equal(home.status, 200);
    const homeHTML = await home.text();
    assert.ok(homeHTML.includes("Staging preview"));
    assert.match(homeHTML, /name="robots" content="noindex, nofollow"/);
    assert.ok(!homeHTML.includes('href="/sign-up"'));
    const stays = await server.fetch(baseURL + "/stays");
    assert.equal(stays.status, 200);
    assert.ok((await stays.text()).includes("No stays found"));
    const catalog = await server.fetch(baseURL + "/api/stays");
    assert.equal(catalog.status, 200);
    assert.equal(catalog.headers.get("cache-control"), "no-store");
    assert.equal(catalog.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.deepEqual((await catalog.json() as { items: unknown[] }).items, []);
    for (const path of ["sign-in", "sign-up", "verify-email", "forgot-password", "reset-password"]) {
      const page = await server.fetch(baseURL + "/" + path);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes("Account access is unavailable"));
      assert.ok(!html.includes('<form'));
      assert.ok(!html.includes('name="password"'));
    }
    const status = await server.fetch(baseURL + "/api/auth/get-session", { headers: { Cookie: "better-auth.session_token=untrusted" } });
    assert.equal(status.status, 200);
    assert.equal(await status.json(), null);
    assert.equal(status.headers.get("set-cookie"), null);
    for (const path of ["sign-up/email", "sign-in/email", "send-verification-email", "request-password-reset", "reset-password", "sign-out"]) {
      const response = await server.fetch(baseURL + "/api/auth/" + path, {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "invalid-json",
      });
      assert.equal(response.status, 503, path);
      assert.deepEqual(await response.json(), { error: "staging_read_only" });
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.equal(response.headers.get("set-cookie"), null);
    }
    for (const path of ["verify-email?token=not-a-token", "get-session/", "%67et-session"]) {
      const response = await server.fetch(baseURL + "/api/auth/" + path, { redirect: "manual" });
      assert.equal(response.status, 503, path);
    }
    for (const [method, path] of [
      ["POST", "/api/bookings"], ["POST", "/api/booking-quotes"],
      ["POST", "/api/owner/properties"], ["PATCH", "/api/owner/properties/p/logistics"],
      ["POST", "/api/owner/properties/p/listing"],
      ["POST", "/api/owner/bookings/b/attempts/a/apply"],
      ["POST", "/api/owner/bookings/b/payments/attempts/a/apply"],
      ["POST", "/api/bookings/b/check_in"], ["POST", "/api/bookings/b/complete"],
      ["PUT", "/api/owner/properties/p/photos/f"],
    ]) {
      const response = await server.fetch(baseURL + path, { method, headers: { Origin: origin, "Content-Type": "application/json" }, body: "invalid-json" });
      assert.equal(response.status, 503, path);
      assert.deepEqual(await response.json(), { error: "staging_read_only" });
      assert.ok(response.headers.get("cache-control")?.includes("no-store"));
    }
    for (const path of ["/api/owner/properties", "/api/guest/bookings", "/api/property-reviews/x/photos/y", "/api/owner/properties/p/photos/f"]) {
      const response = await server.fetch(baseURL + path);
      assert.equal(response.status, 401, path);
    }
    const owner = await server.fetch(baseURL + "/owner", { redirect: "manual" });
    // Next.js may emit the redirect in an already-started HTML stream.
    if (owner.status === 307) assert.ok(owner.headers.get("location")?.includes("/sign-in"));
    else {
      assert.equal(owner.status, 200);
      const html = await owner.text();
      assert.match(html, /http-equiv="refresh"[^>]*url=\/sign-in/);
      assert.ok(!html.includes('href="/owner/properties/new"'));
    }
    assert.deepEqual(await counts(), before);
    const capture = await db.prepare("SELECT name FROM sqlite_master WHERE name IN ('local_email','local_notification')").all();
    assert.equal(capture.results.length, 0);
  } finally { await server.close(); }
});
