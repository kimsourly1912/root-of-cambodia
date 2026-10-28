import { test } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createTestHarness } from "wrangler";
import { catalog, scalar } from "./fixtures";
const baseURL = "http://127.0.0.1:8787";
const server = createTestHarness({
  workers: [
    {
      configPath: "wrangler.jsonc",
      secrets: { BETTER_AUTH_SECRET: randomBytes(32).toString("hex") },
    },
  ],
});
let checks = 0;
const pass = (label: string) => {
  checks++;
  console.log("PASS " + label);
};
const post = (
  path: string,
  body: unknown,
  cookie?: string,
  key?: string,
  origin = baseURL,
  ip = "192.0.2.10",
) =>
  server.fetch(baseURL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      "CF-Connecting-IP": ip,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
    redirect: "manual",
  });
test("built Next.js/OpenNext Worker journey preserves all 12 HTTP checks", async () => {
  try {
    await server.listen();
    const home = await server.fetch(baseURL);
    assert.equal(home.status, 200);
    assert.ok((await home.text()).includes("ការកក់កន្លែងស្នាក់នៅ"));
    pass("Next.js SSR from the built OpenNext Worker");
    const worker = server.getWorker<CloudflareEnv>();
    await worker.applyD1Migrations("DB");
    const db = (await worker.getEnv()).DB;
    const { input } = await catalog(db, 1);
    await db
      .prepare(
        "CREATE TABLE local_email(id TEXT PRIMARY KEY,recipient TEXT NOT NULL,kind TEXT NOT NULL,url TEXT NOT NULL)",
      )
      .run();
    const password = "LocalOnly-WorkerPassword-123!";
    async function account(label: string, ip: string) {
      const email = label + "@example.invalid";
      const signup = await post(
        "/api/auth/sign-up/email",
        { name: label, email, password },
        undefined,
        undefined,
        baseURL,
        ip,
      );
      assert.equal(signup.status, 200);
      const user = ((await signup.json()) as { user: { id: string } }).user;
      assert.equal(
        (
          await post(
            "/api/auth/sign-in/email",
            { email, password },
            undefined,
            undefined,
            baseURL,
            ip,
          )
        ).status,
        403,
      );
      const message = await db
        .prepare(
          "SELECT url FROM local_email WHERE recipient=? AND kind='verify' LIMIT 1",
        )
        .bind(email)
        .first<{ url: string }>();
      assert.ok(message);
      assert.equal(
        (
          await server.fetch(message.url, {
            redirect: "manual",
            headers: { "CF-Connecting-IP": ip },
          })
        ).status,
        302,
      );
      const login = await post(
        "/api/auth/sign-in/email",
        { email, password },
        undefined,
        undefined,
        baseURL,
        ip,
      );
      assert.equal(login.status, 200);
      const cookie = login.headers
        .getSetCookie()
        .map((x) => x.split(";")[0])
        .join("; ");
      assert.ok(cookie);
      return { id: user.id, email, cookie };
    }
    const owner = await account("http-owner", "192.0.2.11"),
      guest = await account("http-guest", "192.0.2.12"),
      other = await account("http-other", "192.0.2.13");
    await db.batch([
      db
        .prepare("INSERT INTO owner_profile VALUES (?,?)")
        .bind(owner.id, "Owner"),
      db.prepare("UPDATE property SET owner_id=? WHERE id='p'").bind(owner.id),
    ]);
    pass(
      "Better Auth signup, verification and sessions use the versioned application auth schema",
    );
    assert.equal((await post("/api/booking-quotes", input)).status, 401);
    assert.equal(
      (
        await post(
          "/api/booking-quotes",
          input,
          guest.cookie,
          undefined,
          "https://untrusted.example.invalid",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await server.fetch(baseURL + "/api/booking-quotes", {
          method: "POST",
          headers: { Cookie: guest.cookie, "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ).status,
      403,
    );
    pass("Anonymous, cross-origin and missing-origin mutations rejected");
    const preview = await post("/api/booking-quotes", input, guest.cookie);
    assert.equal(preview.status, 200);
    assert.ok(preview.headers.get("cache-control")?.includes("no-store"));
    const q = (await preview.json()) as { hash: string; totalCents: number };
    assert.equal(q.totalCents, 7500);
    assert.equal(
      (
        await post(
          "/api/bookings",
          { ...input, quoteHash: q.hash },
          guest.cookie,
        )
      ).status,
      422,
    );
    const payload = {
      ...input,
      quoteHash: q.hash,
      ownerId: owner.id,
      emailVerified: true,
      totalCents: 1,
    };
    const first = await post(
      "/api/bookings",
      payload,
      guest.cookie,
      "submit-a",
    );
    assert.equal(first.status, 200);
    const a = (await first.json()) as { id: string; status: string };
    assert.equal(a.status, "pending");
    const repeat = await post(
      "/api/bookings",
      payload,
      guest.cookie,
      "submit-a",
    );
    assert.deepEqual(await repeat.json(), a);
    assert.equal(
      (
        await post(
          "/api/bookings",
          { ...payload, lines: [{ ...input.lines[0], adults: 1 }] },
          guest.cookie,
          "submit-a",
        )
      ).status,
      409,
    );
    pass(
      "Authoritative quote submission and scoped idempotent replay from real session cookies",
    );
    const read = await server.fetch(baseURL + "/api/bookings/" + a.id, {
      headers: { Cookie: guest.cookie },
    });
    assert.equal(read.status, 200);
    assert.ok(read.headers.get("cache-control")?.includes("private"));
    assert.equal(
      ((await read.json()) as { totalCents: number }).totalCents,
      7500,
    );
    assert.equal(
      (await server.fetch(baseURL + "/api/bookings/" + a.id)).status,
      401,
    );
    assert.equal(
      (
        await server.fetch(baseURL + "/api/bookings/" + a.id, {
          headers: { Cookie: other.cookie },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await post(
          "/api/bookings/" + a.id + "/accept",
          { ownerId: owner.id, emailVerified: true },
          other.cookie,
          "other-accept",
        )
      ).status,
      404,
    );
    pass(
      "Private guest data and owner mutations cannot cross account/property boundaries",
    );
    const second = await post(
      "/api/bookings",
      payload,
      guest.cookie,
      "submit-b",
    );
    assert.equal(second.status, 200);
    const b = (await second.json()) as { id: string };
    const acceptance = await Promise.all(
      [a, b].map((r, i) =>
        post(
          "/api/bookings/" + r.id + "/accept",
          {},
          owner.cookie,
          "accept-" + i,
        ),
      ),
    );
    assert.deepEqual(acceptance.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
    pass("HTTP simultaneous acceptances cannot oversell the last room");
    const confirmed = await db
      .prepare("SELECT id FROM booking WHERE status='confirmed'")
      .first<{ id: string }>();
    assert.ok(confirmed);
    assert.equal(
      (
        await post(
          "/api/bookings/" + confirmed.id + "/cancel_owner",
          {},
          owner.cookie,
          "cancel-no-reason",
        )
      ).status,
      422,
    );
    const cancel = await post(
      "/api/bookings/" + confirmed.id + "/cancel_owner",
      { reason: "Maintenance" },
      owner.cookie,
      "cancel",
    );
    assert.equal(cancel.status, 200);
    assert.equal(
      (
        await post(
          "/api/bookings/" + confirmed.id + "/cancel_owner",
          { reason: "Maintenance" },
          owner.cookie,
          "cancel",
        )
      ).status,
      200,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    pass("Owner reason and retry-safe inventory release through HTTP");
    assert.equal(
      (
        await post(
          "/api/bookings/" + confirmed.id + "/check_in",
          {},
          owner.cookie,
          "arrival",
        )
      ).status,
      422,
    );
    assert.equal(
      (
        await post(
          "/api/booking-quotes",
          { ...input, lines: [{ ...input.lines[0], infants: 1 }] },
          guest.cookie,
        )
      ).status,
      422,
    );
    pass("Unresolved arrival and infant policies are not silently invented");
    const bad = await server.fetch(baseURL + "/api/booking-quotes", {
      method: "POST",
      headers: {
        Origin: baseURL,
        Cookie: guest.cookie,
        "Content-Type": "application/json",
      },
      body: "{",
    });
    assert.equal(bad.status, 422);
    const large = await post(
      "/api/booking-quotes",
      { padding: "x".repeat(33000) },
      guest.cookie,
    );
    assert.equal(large.status, 413);
    pass("Bounded JSON request parsing and no-store error responses");
    const reset = await post(
      "/api/auth/request-password-reset",
      { email: owner.email, redirectTo: baseURL + "/reset-password" },
      undefined,
      undefined,
      baseURL,
      "192.0.2.30",
    );
    assert.equal(reset.status, 200);
    const message = await db
      .prepare(
        "SELECT url FROM local_email WHERE recipient=? AND kind='reset' LIMIT 1",
      )
      .bind(owner.email)
      .first<{ url: string }>();
    assert.ok(message);
    const token = new URL(message.url).pathname.split("/").at(-1),
      newPassword = "LocalOnly-NewPassword-456!";
    assert.equal(
      (
        await post(
          "/api/auth/reset-password",
          { token, newPassword },
          undefined,
          undefined,
          baseURL,
          "192.0.2.30",
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await post(
          "/api/auth/sign-in/email",
          { email: owner.email, password },
          undefined,
          undefined,
          baseURL,
          "192.0.2.30",
        )
      ).status,
      401,
    );
    assert.equal(
      (
        await post(
          "/api/auth/sign-in/email",
          { email: owner.email, password: newPassword },
          undefined,
          undefined,
          baseURL,
          "192.0.2.30",
        )
      ).status,
      200,
    );
    pass("Password reset uses captured mail and changes the credential");
    const attempts = [];
    for (let i = 0; i < 4; i++)
      attempts.push(
        await post(
          "/api/auth/sign-in/email",
          { email: owner.email, password: "WrongPassword" },
          undefined,
          undefined,
          baseURL,
          "192.0.2.99",
        ),
      );
    assert.equal(attempts.at(-1)?.status, 429);
    assert.ok((await scalar(db, "SELECT count(*) n FROM rateLimit")) > 0);
    pass("Database-backed authentication throttling stays enabled");
    await db
      .prepare("UPDATE user SET emailVerified=0 WHERE id=?")
      .bind(guest.id)
      .run();
    assert.equal(
      (
        await server.fetch(baseURL + "/api/bookings/" + a.id, {
          headers: { Cookie: guest.cookie },
        })
      ).status,
      403,
    );
    pass(
      "Application rechecks verification in D1 even with an existing session",
    );
    assert.equal(checks, 12, "All historical built-Worker checks must execute");
    console.log(
      JSON.stringify({
        checks,
        result: "passed",
        runtime: "local built Worker",
        email: "capture only",
      }),
    );
  } finally {
    await server.close();
  }
});
