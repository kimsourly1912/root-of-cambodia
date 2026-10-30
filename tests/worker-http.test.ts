import {setStayClock} from "./stay-fixtures";
import { test, expect } from "vitest";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createTestHarness } from "wrangler";
import type { DiagnosticRecord } from "@root-of-cambodia/backend/diagnostics";
import { catalog, scalar } from "./fixtures";
import { ensureAcceptanceFixture } from "./booking-fixtures";
import { readyPublicationFixture } from "./publication-fixtures";
import photoFixtures from "./photo-fixtures.json" with { type: "json" };
import { mediaKeys } from "@root-of-cambodia/backend/media-queries";
const baseURL = "http://127.0.0.1:8787";
const server = createTestHarness({
  workers: [
    {
      configPath: "apps/web/wrangler.jsonc",
      secrets: { BETTER_AUTH_SECRET: randomBytes(32).toString("hex") },
    },
    {
      configPath: "apps/jobs/wrangler.jsonc",
      prebuiltWorkerDir: "apps/jobs/dist",
    },
  ],
});
const diagnosticsFromWorker = () =>
  server.getLogs().flatMap((log) => {
    try {
      const value = JSON.parse(log.message);
      return value?.version === 1 && typeof value?.correlationId === "string"
        ? [value as DiagnosticRecord]
        : [];
    } catch {
      return [];
    }
  });
let checks = 0;
const pass = (label: string) => {
  checks++;
  console.log("PASS " + label);
};
const post = async (
  path: string,
  body: unknown,
  cookie?: string,
  key?: string,
  origin = baseURL,
  ip = "192.0.2.10",
) => {
  if(path.endsWith("/accept") && cookie && body && typeof body==="object" && !("acceptanceHash" in body)) {
    const id=path.split("/").at(-2);
    const preview=await server.fetch(baseURL+"/api/owner/bookings/"+id+"/acceptance",{headers:{Cookie:cookie}});
    if(preview.status===200)body={...body,acceptanceHash:(await preview.json() as {hash:string}).hash};
  }
  return server.fetch(baseURL + path, {
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
};
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
    await ensureAcceptanceFixture(db,"p");
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
    const anonymous = await server.fetch(
      baseURL + "/api/booking-quotes?private-query=never-log",
      {
        method: "POST",
        headers: {
          Origin: baseURL,
          "Content-Type": "application/json",
          "X-Request-Id": "private-client-reference-never-log",
        },
        body: JSON.stringify(input),
      },
    );
    assert.equal(anonymous.status, 401);
    assert.deepEqual(await anonymous.json(), { error: "unauthorized" });
    const anonymousReference = anonymous.headers.get("x-request-id");
    assert.match(anonymousReference!, /^[a-f0-9-]{36}$/);
    await expect
      .poll(() =>
        diagnosticsFromWorker().some(
          (r) =>
            r.correlationId === anonymousReference &&
            r.code === "unauthorized" &&
            r.event === "failure",
        ),
      )
      .toBe(true);
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
    assert.match(preview.headers.get("x-request-id")!, /^[a-f0-9-]{36}$/);
    assert.notEqual(preview.headers.get("x-request-id"), anonymousReference);
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
      409,
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
    // The two actual bundles must see the same database, not merely equal schemas.
    const jobs = server.getWorker<JobsEnv>("roc-jobs-local");
    const jobsDb = (await jobs.getEnv()).DB;
    assert.equal(await scalar(jobsDb, "SELECT count(*) n FROM booking"), 2);
    await db
      .prepare(
        "CREATE TABLE local_notification(id TEXT PRIMARY KEY,booking_id TEXT NOT NULL,kind TEXT NOT NULL,recipient TEXT NOT NULL)",
      )
      .run();
    const notifications = await scalar(
      db,
      "SELECT count(*) n FROM notification_outbox",
    );
    assert.equal((await jobs.scheduled({})).outcome, "ok");
    await expect
      .poll(
        () =>
          scalar(
            db,
            "SELECT count(*) n FROM notification_outbox WHERE state='delivered'",
          ),
        { timeout: 10_000 },
      )
      .toBe(notifications);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM local_notification"),
      notifications,
    );
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
    // Exercise a genuine unknown runtime/database failure after retaining every
    // historical journey assertion. No raw SQL error may become an API/log field.
    await db
      .prepare("UPDATE user SET emailVerified=1 WHERE id=?")
      .bind(guest.id)
      .run();
    // Publication adapters reuse the real session/Origin/private-response boundary.
    const draftFields={ownerName:"Owner",nameKm:"ផ្ទះ",nameEn:"Review house",province:"Kampot",checkinTime:"14:00",checkoutTime:"11:00",policyText:"Quiet hours"};
    const draftResponse=await post("/api/owner/properties",draftFields,owner.cookie,"review-draft");
    assert.equal(draftResponse.status,201);
    await expect
      .poll(() =>
        diagnosticsFromWorker().some(
          (record) =>
            record.correlationId === draftResponse.headers.get("x-request-id") &&
            record.event === "completed" &&
            record.status === draftResponse.status,
        ),
      )
      .toBe(true);
    const draft=await draftResponse.json() as {id:string};
    const reviewPath="/api/owner/properties/"+draft.id+"/review";
    assert.equal((await post(reviewPath,{action:"submit",propertyRevision:1},owner.cookie,"review-submit")).status,422);
    assert.equal((await server.fetch(baseURL+"/api/property-reviews",{headers:{Cookie:owner.cookie}})).status,404);
    assert.equal((await post("/__test/pilot-reviewer",{userId:owner.id,termsVersion:"forged"},owner.cookie)).status,404);
    await db.prepare("INSERT INTO pilot_publication_config VALUES(1,?,NULL,1)").bind(other.id).run();
    const incomplete = await post(reviewPath,{action:"submit",propertyRevision:1},owner.cookie,"review-incomplete");
    assert.equal(incomplete.status,422);
    assert.deepEqual(await incomplete.json(),{error:"publication_incomplete"});
    const guidance = await server.fetch(baseURL+reviewPath,{headers:{Cookie:owner.cookie}});
    assert.ok(guidance.headers.get("cache-control")?.includes("no-store"));
    const guidanceBody = await guidance.json() as {readiness:{ready:boolean;missing:string[]}};
    assert.equal(guidanceBody.readiness.ready,false);
    assert.ok(guidanceBody.readiness.missing.includes("description"));
    const publicSupply=await readyPublicationFixture(db,{id:owner.id},draft.id);
    assert.equal((await post(reviewPath,{action:"submit",propertyRevision:1},owner.cookie,"no-disclosure")).status,422);
    const previewState=await (await server.fetch(baseURL+reviewPath,{headers:{Cookie:owner.cookie}})).json() as {publicPreview:{version:string;previewHash:string}};
    const submitBody={action:"submit",propertyRevision:1,publicDisclosure:{version:previewState.publicPreview.version,previewHash:previewState.publicPreview.previewHash}};
    assert.equal((await post(reviewPath,submitBody,owner.cookie,"review-submit","https://untrusted.invalid")).status,403);
    const submitted=await post(reviewPath,submitBody,owner.cookie,"review-submit");
    assert.equal(submitted.status,200);assert.ok(submitted.headers.get("cache-control")?.includes("no-store"));
    const pending=await submitted.json() as {id:string;status:string};
    const queue=await server.fetch(baseURL+"/api/property-reviews",{headers:{Cookie:other.cookie}});
    assert.equal(queue.status,200);assert.ok(queue.headers.get("cache-control")?.includes("no-store"));
    assert.equal((await post("/api/property-reviews/"+pending.id,{action:"approve",revision:1,configRevision:1},other.cookie,"review-approve")).status,422);
    const details=await server.fetch(baseURL+"/api/property-reviews/"+pending.id,{headers:{Cookie:other.cookie}});
    assert.equal(details.status,200);
    const photo=await server.fetch(baseURL+"/api/property-reviews/"+pending.id+"/photos/missing",{headers:{Cookie:other.cookie}});
    assert.equal(photo.status,404);assert.equal(photo.headers.get("x-content-type-options"),"nosniff");
    const returned=await post("/api/property-reviews/"+pending.id,{action:"return_changes",revision:1,configRevision:1,reason:"Please add directions."},other.cookie,"review-return");
    assert.equal(returned.status,200);
    assert.equal((await returned.json() as {status:string}).status,"returned");
    assert.equal((await server.fetch(baseURL+"/api/stays/"+draft.id)).status,404);
    await db.prepare("UPDATE pilot_publication_config SET terms_version='http-approved-v1',revision=revision+1").run();
    const resubmitted=await post(reviewPath,submitBody,owner.cookie,"public-resubmit");
    assert.equal(resubmitted.status,200);
    const publicRequest=await resubmitted.json() as {id:string};
    const approved=await post("/api/property-reviews/"+publicRequest.id,{action:"approve",revision:1,configRevision:2},other.cookie,"public-approve");
    assert.equal(approved.status,200);
    const publicResponse=await server.fetch(baseURL+"/api/stays/"+draft.id);
    assert.equal(publicResponse.status,200);assert.equal(publicResponse.headers.get("cache-control"),"no-store");assert.equal(publicResponse.headers.get("set-cookie"),null);
    const publicBody=await publicResponse.json() as {id:string;photos:{id:string}[]};
    assert.equal(publicBody.id,draft.id);assert.equal(publicBody.photos[0].id,publicSupply.photoId);
    const publicJSON=JSON.stringify(publicBody);
    for(const excluded of ["River lane, Kampot","stay@example.invalid",'"ownerId"','"address"','"latitude"','"arrivalInstructions"','"previewHash"','"unitCents"',"private/properties/"])assert.ok(!publicJSON.includes(excluded),excluded);
    const listResponse=await server.fetch(baseURL+"/api/stays?q=review&province=kampot");
    assert.equal(listResponse.status,200);
    assert.deepEqual((await listResponse.json() as {items:{id:string}[]}).items.map((item)=>item.id),[draft.id]);
    // Real D1 limits LIKE/GLOB patterns to 50 bytes. Valid 100-character
    // searches, including multibyte Khmer, must still return a safe empty page.
    for (const q of ["Missing-" + "x".repeat(92), "ផ្ទះ".repeat(25)]) {
      const emptySearch = "/stays?" + new URLSearchParams({ q, province: "" });
      const emptyAPI = await server.fetch(baseURL + "/api" + emptySearch);
      assert.equal(emptyAPI.status, 200);
      assert.deepEqual((await emptyAPI.json() as {items:unknown[]}).items, []);
      const emptyHTML = await (await server.fetch(baseURL + emptySearch)).text();
      assert.ok(emptyHTML.includes("No stays found"));
    }
    assert.equal((await server.fetch(baseURL+"/api/stays?q=a&q=b")).status,422);
    assert.equal((await server.fetch(baseURL+"/api/stays?ownerId="+owner.id)).status,422);
    assert.equal((await post("/api/stays",{})).status,405);
    const publicHTML=await (await server.fetch(baseURL+"/stays/"+draft.id)).text();
    assert.ok(publicHTML.includes("Review house"));
    for(const excluded of ["River lane, Kampot","stay@example.invalid","private/properties/",'"previewHash"'])assert.ok(!publicHTML.includes(excluded),excluded);
    const keys=mediaKeys({id:publicSupply.photoId!,property_id:draft.id});
    const media=(await worker.getEnv()).MEDIA;
    await media.put(keys.original,"PRIVATE_ORIGINAL_BYTES");
    await media.put(keys.preview,Buffer.from(photoFixtures.jpeg,"base64"));
    const publicPhoto=await server.fetch(baseURL+"/api/stays/"+draft.id+"/photos/"+publicSupply.photoId);
    assert.equal(publicPhoto.status,200);assert.equal(publicPhoto.headers.get("content-type"),"image/jpeg");assert.equal(publicPhoto.headers.get("cache-control"),"no-store");assert.equal(publicPhoto.headers.get("x-content-type-options"),"nosniff");
    assert.deepEqual(Buffer.from(await publicPhoto.arrayBuffer()),Buffer.from(photoFixtures.jpeg,"base64"));
    assert.equal((await server.fetch(baseURL+"/api/stays/"+draft.id+"/photos/not-a-member")).status,404);
    assert.equal((await server.fetch(baseURL+"/api/stays/"+draft.id+"/photos/"+publicSupply.photoId+"/original")).status,404);
    // New guest screen adapters run against the actual Worker, retaining every earlier check.
    assert.equal(await scalar(db,"SELECT count(*) n FROM booking"),2);
    const selection={propertyId:draft.id,termsVersion:"http-approved-v1",checkin:publicSupply.night,checkout:new Date(Date.parse(publicSupply.night)+86400000).toISOString().slice(0,10),lines:[{roomId:publicSupply.roomId,quantity:1,adults:1,children:0}]};
    assert.equal((await post("/api/guest/quote",selection,guest.cookie)).status,422);
    await db.prepare("INSERT INTO booking_terms_document(version,content) VALUES ('http-approved-v1','Synthetic HTTP terms only.')").run();
    assert.equal((await post("/api/guest/quote",selection)).status,401);
    const guestQuoteResponse=await post("/api/guest/quote",selection,guest.cookie);
    assert.equal(guestQuoteResponse.status,200);
    const guestQuote=await guestQuoteResponse.json() as {input:typeof selection;hash:string};
    for(const excluded of ['"owner_id"','"address"','"user"','"reserved"'])assert.ok(!JSON.stringify(guestQuote).includes(excluded),excluded);
    const attemptId=crypto.randomUUID(),attemptPath="/api/guest/attempts/"+attemptId;
    const reviewBody={...guestQuote.input,quoteHash:guestQuote.hash};
    assert.equal((await post(attemptPath,reviewBody,guest.cookie)).status,200);
    assert.equal((await server.fetch(baseURL+attemptPath,{headers:{Cookie:other.cookie}})).status,404);
    assert.equal((await post(attemptPath+"/send",{acceptedTerms:false},guest.cookie)).status,422);
    const reviewHTML=await server.fetch(baseURL+"/bookings/requests/"+attemptId,{headers:{Cookie:guest.cookie}});
    assert.equal(reviewHTML.status,200);assert.ok(reviewHTML.headers.get("cache-control")?.includes("no-store"));
    const reviewText=await reviewHTML.text();assert.ok(reviewText.includes("Synthetic HTTP terms only."));assert.ok(!reviewText.includes("stay@example.invalid"));
    const guestSubmitted=await post(attemptPath+"/send",{acceptedTerms:true},guest.cookie);
    assert.equal(guestSubmitted.status,200);const newBooking=await guestSubmitted.json() as {id:string;status:string};assert.equal(newBooking.status,"pending");
    assert.deepEqual(await (await post(attemptPath+"/send",{acceptedTerms:true},guest.cookie)).json(),newBooking);
    const detailPath="/api/guest/bookings/"+newBooking.id;
    assert.equal((await server.fetch(baseURL+detailPath,{headers:{Cookie:owner.cookie}})).status,404);
    const guestDetail=await server.fetch(baseURL+detailPath,{headers:{Cookie:guest.cookie}});assert.equal(guestDetail.status,200);assert.ok(guestDetail.headers.get("cache-control")?.includes("no-store"));assert.ok(!(await guestDetail.text()).includes("stay@example.invalid"));
    const ownPage=await server.fetch(baseURL+"/bookings/"+newBooking.id,{headers:{Cookie:guest.cookie}});assert.equal(ownPage.status,200);assert.ok((await ownPage.text()).includes("Pending confirmation"));
    const list=await server.fetch(baseURL+"/api/guest/bookings",{headers:{Cookie:guest.cookie}});assert.equal(list.status,200);assert.ok((await list.json() as {items:{id:string}[]}).items.some(item=>item.id===newBooking.id));
    assert.equal((await server.fetch(baseURL+"/api/guest/bookings?cursor=a&cursor=b",{headers:{Cookie:guest.cookie}})).status,422);
    const rawAcceptance=await server.fetch(baseURL+"/api/bookings/"+newBooking.id+"/accept",{method:"POST",headers:{Cookie:owner.cookie,Origin:baseURL,"Content-Type":"application/json","Idempotency-Key":"no-preview"},body:"{}"});
    assert.equal(rawAcceptance.status,422);
    const previewResponse=await server.fetch(baseURL+"/api/owner/bookings/"+newBooking.id+"/acceptance",{headers:{Cookie:owner.cookie}});assert.equal(previewResponse.status,200);const guestAcceptance=await previewResponse.json() as {hash:string};
    const responseId=crypto.randomUUID(),responsePath="/api/owner/bookings/"+newBooking.id+"/attempts/"+responseId;
    assert.equal((await post(responsePath,{action:"accept",acceptanceHash:guestAcceptance.hash},owner.cookie)).status,200);
    assert.equal((await server.fetch(baseURL+responsePath,{headers:{Cookie:guest.cookie}})).status,404);
    assert.equal((await post(responsePath+"/apply",{},owner.cookie)).status,200);
    assert.equal((await post(responsePath+"/apply",{},owner.cookie)).status,200);
    const confirmedGuest=await server.fetch(baseURL+detailPath,{headers:{Cookie:guest.cookie}});assert.equal(confirmedGuest.status,200);assert.ok((await confirmedGuest.text()).includes("stay@example.invalid"));
    const ownerCollection=await server.fetch(baseURL+"/api/owner/properties/"+draft.id+"/bookings",{headers:{Cookie:owner.cookie}});assert.equal(ownerCollection.status,200);assert.equal((await server.fetch(baseURL+"/api/owner/properties/"+draft.id+"/bookings",{headers:{Cookie:other.cookie}})).status,404);
    await db.prepare("UPDATE place SET publication='paused' WHERE id=?").bind(draft.id).run();
    assert.ok((await (await server.fetch(baseURL+detailPath,{headers:{Cookie:guest.cookie}})).text()).includes("stay@example.invalid"));
    assert.equal((await post("/api/bookings/"+newBooking.id+"/cancel_guest",{},guest.cookie,"new-guest-cancel")).status,200);
    assert.equal((await post("/api/bookings/"+newBooking.id+"/cancel_guest",{},guest.cookie,"new-guest-cancel")).status,200);
    assert.ok(!(await (await server.fetch(baseURL+detailPath,{headers:{Cookie:guest.cookie}})).text()).includes("stay@example.invalid"));
    await db.prepare("UPDATE place SET publication='paused' WHERE id=?").bind(draft.id).run();
    assert.equal((await server.fetch(baseURL+"/api/stays/"+draft.id)).status,404);
    assert.equal((await server.fetch(baseURL+"/api/stays/"+draft.id+"/photos/"+publicSupply.photoId)).status,404);
    // Existing owner-only external allocation also supports the scoped arrival/completion actions while paused.
    const externalPreview=await post("/api/external-reservations",{...selection,preview:true},owner.cookie);
    assert.equal(externalPreview.status,200);
    const externalHash=(await externalPreview.json() as {hash:string}).hash;
    const stayResponse=await post("/api/external-reservations",{...selection,quoteHash:externalHash},owner.cookie,"stay-external");
    assert.equal(stayResponse.status,200);const stayBooking=await stayResponse.json() as {id:string};
    const stayRecord=await db.prepare("SELECT checkin_at FROM booking WHERE id=?").bind(stayBooking.id).first<{checkin_at:number}>();
    assert.equal((await post("/api/bookings/"+stayBooking.id+"/check_in",{},owner.cookie,"stay-early")).status,409);
    await setStayClock(db,stayBooking.id,stayRecord!.checkin_at);
    assert.equal((await post("/api/bookings/"+stayBooking.id+"/check_in",{},guest.cookie,"stay-guest")).status,404);
    assert.equal((await post("/api/bookings/"+stayBooking.id+"/check_in",{},owner.cookie,"stay-arrive")).status,200);
    assert.equal((await post("/api/bookings/"+stayBooking.id+"/complete",{},owner.cookie,"stay-complete")).status,200);
    assert.equal((await post("/api/bookings/"+stayBooking.id+"/check_in",{},owner.cookie,"stay-arrive")).status,200);
    assert.equal((await db.prepare("SELECT status FROM booking WHERE id=?").bind(stayBooking.id).first<{status:string}>())!.status,"completed");
    const paymentBase="/api/owner/bookings/"+stayBooking.id+"/payments",paymentId=crypto.randomUUID(),paymentPath=paymentBase+"/attempts/"+paymentId;
    const paymentStock=await scalar(db,"SELECT sum(reserved) n FROM inventory_night");
    assert.equal((await server.fetch(baseURL+paymentBase,{headers:{Cookie:guest.cookie}})).status,404);
    assert.equal((await post(paymentPath,{action:"record",revision:0},owner.cookie,undefined,"https://elsewhere.invalid")).status,403);
    assert.equal((await post(paymentPath,{action:"record",revision:0,amountCents:1},owner.cookie)).status,422);
    assert.equal((await post(paymentPath,{action:"record",revision:0},owner.cookie)).status,200);
    const recorded=await post(paymentPath+"/apply",{},owner.cookie);assert.equal(recorded.status,200);assert.ok(recorded.headers.get("cache-control")?.includes("no-store"));
    assert.deepEqual(await (await post(paymentPath+"/apply",{},owner.cookie)).json(),await recorded.json());
    assert.equal((await server.fetch(baseURL+paymentPath,{headers:{Cookie:other.cookie}})).status,404);
    const correctionPath=paymentBase+"/attempts/"+crypto.randomUUID();
    assert.equal((await post(correctionPath,{action:"void",revision:1,reason:"PRIVATE_PAYMENT_CORRECTION"},owner.cookie)).status,200);
    assert.equal((await post(correctionPath+"/apply",{},owner.cookie)).status,200);
    const paymentHistory=await server.fetch(baseURL+paymentBase,{headers:{Cookie:owner.cookie}});assert.equal(paymentHistory.status,200);assert.ok(paymentHistory.headers.get("cache-control")?.includes("no-store"));
    const paymentBody=await paymentHistory.json() as {status:string;events:unknown[]};assert.equal(paymentBody.status,"not_recorded");assert.equal(paymentBody.events.length,2);
    assert.equal(await scalar(db,"SELECT sum(reserved) n FROM inventory_night"),paymentStock);
    assert.equal((await db.prepare("SELECT status FROM booking WHERE id=?").bind(stayBooking.id).first<{status:string}>())!.status,"completed");
    // Keep newly populated calendar-history references intact while making the
    // application's expected table unavailable for this isolated failure test.
    await db.prepare("ALTER TABLE nightly_rate RENAME TO fault_unavailable_rates").run();
    const unavailable = await post("/api/booking-quotes", input, guest.cookie);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), {
      error: "temporarily_unavailable_retry_same_key",
    });
    assert.ok(unavailable.headers.get("cache-control")?.includes("no-store"));
    await db.prepare("ALTER TABLE public_listing_disclosure RENAME TO fault_unavailable_disclosure").run();
    const publicUnavailable=await server.fetch(baseURL+"/api/stays");
    assert.equal(publicUnavailable.status,503);
    assert.deepEqual(await publicUnavailable.json(),{error:"temporarily_unavailable_retry_same_key"});
    assert.equal(publicUnavailable.headers.get("cache-control"),"no-store");
    await expect
      .poll(() =>
        diagnosticsFromWorker().some(
          (r) =>
            r.correlationId === unavailable.headers.get("x-request-id") &&
            r.reason === "unexpected_failure",
        ),
      )
      .toBe(true);
    const diagnosticJson = JSON.stringify(diagnosticsFromWorker());
    for (const secret of [
      guest.cookie,
      password,
      "private-query",
      "private-client-reference",
      "PRIVATE_PAYMENT_CORRECTION",
      "nightly_rate",
      "public_listing_disclosure",
      guest.email,
    ])
      assert.ok(
        !diagnosticJson.includes(secret),
        "Private content in diagnostics",
      );
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 4);
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
