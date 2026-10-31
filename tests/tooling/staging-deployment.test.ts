import { test } from "vitest";
import assert from "node:assert/strict";
import { assertStagingSchema } from "../../scripts/check-staging-schema.ts";
import { smokeStaging, stagingOrigin } from "../../scripts/smoke-staging.ts";

test("staging deploy refuses missing, pending, unknown or malformed migration tracking", () => {
  const files = ["0001_first.sql", "0002_second.sql"];
  const tracked = (names: unknown[]) => [{ success: true, results: names.map(name => ({ name })) }];
  assert.doesNotThrow(() => assertStagingSchema(files, tracked([...files].reverse())));
  for (const output of [null, [], [{ success: false, results: [] }], tracked(files.slice(1)),
    tracked([...files, "0003_unknown.sql"]), tracked([files[0], files[0]]), tracked([null])]) {
    assert.throws(() => assertStagingSchema(files, output));
  }
});

const revision = "a".repeat(40);
function smokeFixture(overrides: Record<string, () => Response> = {}) {
  const calls: string[] = [];
  const request: typeof fetch = async (input, init) => {
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, undefined); // GET only, no writes or credentials.
    assert.equal(init?.body, undefined);
    const url = new URL(String(input));
    assert.equal(url.origin, stagingOrigin);
    calls.push(url.pathname);
    if (overrides[url.pathname]) return overrides[url.pathname]();
    const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
    if (url.pathname === "/api/health") return Response.json({ status: "ok", revision }, { headers });
    if (url.pathname === "/api/stays") return Response.json({ items: [] }, { headers });
    if (url.pathname === "/api/auth/get-session") return Response.json(null, { headers });
    if (url.pathname.startsWith("/api/")) return Response.json({ error: "unauthorized" }, { status: 401, headers });
    return new Response('<meta name="robots" content="noindex, nofollow">Staging test', { headers });
  };
  return { request, calls };
}

test("staging smoke requires the deployed revision and retries read-only propagation", async () => {
  let healthCalls = 0;
  const { request, calls } = smokeFixture({ "/api/health": () => Response.json({ status: "ok", revision: ++healthCalls === 1 ? "b".repeat(40) : revision }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }) });
  await smokeStaging(revision, request, async () => {});
  assert.equal(healthCalls, 2);
  assert.ok(calls.includes("/api/owner/properties"));
  assert.ok(calls.includes("/api/guest/bookings"));
  const stale = smokeFixture({ "/api/health": () => Response.json({ status: "ok", revision: "b".repeat(40) }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }) });
  await assert.rejects(smokeStaging(revision, stale.request, async () => {}), /expected healthy commit/);
  assert.equal(stale.calls.length, 12);
  await assert.rejects(smokeStaging("main", request), /full commit SHA/);
});

test("staging smoke fails on public-cache, private-access, session or runtime regressions", async () => {
  for (const [pathname, response] of [
    ["/api/stays", () => Response.json({ items: [] })],
    ["/api/owner/properties", () => Response.json({}, { headers: { "Cache-Control": "no-store" } })],
    ["/api/auth/get-session", () => Response.json({ user: {} }, { headers: { "Cache-Control": "no-store" } })],
    ["/testing", () => new Response("Local preview")],
  ] as const) {
    const { request } = smokeFixture({ [pathname]: response });
    await assert.rejects(smokeStaging(revision, request, async () => {}));
  }
});
