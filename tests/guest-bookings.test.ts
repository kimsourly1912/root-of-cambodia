import { env } from "cloudflare:workers";
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  database,
  catalog,
  guest,
  owner,
  other,
  unverified,
  scalar,
  request,
  migrate,
} from "./support";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import { readyPublicationFixture, disclosureFor } from "./publication-fixtures";
import {
  ownerReviewAction,
  decideReview,
} from "@root-of-cambodia/backend/publication";
import {
  guestQuote,
  requestContext,
  saveGuestAttempt,
  guestAttempt,
  sendGuestAttempt,
  guestBookings,
  guestBooking,
} from "@root-of-cambodia/backend/bookings";
import { submit } from "@root-of-cambodia/backend/bookings";
import { testTransition as transition } from "./booking-fixtures";
import { shiftNight } from "@root-of-cambodia/backend/calendar";
async function supply(db: D1Database) {
  await catalog(db);
  await db
    .prepare(
      "INSERT INTO pilot_publication_config VALUES (1,'other','guest-test-v1',1)",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO booking_terms_document(version,content) VALUES ('guest-test-v1','Synthetic local terms only. Pay at the property.')",
    )
    .run();
  const p = await createPropertyDraft(db, owner, "draft", {
    ownerName: "Owner",
    nameKm: "ស្នាក់នៅ",
    nameEn: "Guest stay",
    province: "Kampot",
    checkinTime: "14:00",
    checkoutTime: "11:00",
    policyText: "Quiet at night.",
  });
  const s = await readyPublicationFixture(db, owner, p.id);
  const review = await ownerReviewAction(db, owner, "review", p.id, {
    action: "submit",
    propertyRevision: 1,
    publicDisclosure: await disclosureFor(db, p.id, owner.id),
  });
  await decideReview(db, other, "approve", review.id, {
    action: "approve",
    revision: 1,
    configRevision: 1,
  });
  return {
    propertyId: p.id,
    termsVersion: "guest-test-v1",
    checkin: s.night,
    checkout: shiftNight(s.night, 1),
    lines: [{ roomId: s.roomId, quantity: 1, adults: 1, children: 0 }],
  };
}
test("guest quote returns a safe projection and requires configured immutable terms and current public membership", async () => {
  const p = await database();
  try {
    const db = p.db,
      input = await supply(db),
      q = await guestQuote(db, guest, input);
    assert.equal(q.totalCents, 3500);
    assert.equal(
      q.terms.content,
      "Synthetic local terms only. Pay at the property.",
    );
    for (const key of [
      '"owner_id"',
      '"user"',
      '"guestEmail"',
      '"address"',
      '"contactEmail"',
      '"revision"',
      '"reserved"',
    ])
      assert.ok(!JSON.stringify(q).includes(key), key);
    assert.equal(
      (await requestContext(db, guest, input.propertyId)).guestName,
      "guest",
    );
    await assert.rejects(
      guestQuote(db, unverified, input),
      /verified_session_required/,
    );
    await assert.rejects(
      guestQuote(db, guest, {
        ...input,
        lines: [{ ...input.lines[0], roomId: "r" }],
      }),
      /room_unavailable/,
    );
    await assert.rejects(
      guestQuote(db, guest, {
        ...input,
        checkin: "2020-01-01",
        checkout: "2020-01-02",
      }),
      /incomplete_rates|inventory_unavailable|lead_time_required/,
    );
    await db
      .prepare(
        "UPDATE pilot_publication_config SET terms_version=NULL,revision=revision+1",
      )
      .run();
    await assert.rejects(
      guestQuote(db, guest, input),
      /booking_terms_unavailable/,
    );
    await assert.rejects(
      db.prepare("UPDATE booking_terms_document SET content='changed'").run(),
      /immutable_terms/,
    );
  } finally {
    await p.dispose();
  }
});
test("saved request review recovers one submission after reload, changed catalog and cancellation without leaking another guest's attempt", async () => {
  const p = await database();
  try {
    const db = p.db,
      input = await supply(db),
      q = await guestQuote(db, guest, input),
      id = crypto.randomUUID();
    const [a, b] = await Promise.all([
      saveGuestAttempt(db, guest, id, input, q.hash),
      saveGuestAttempt(db, guest, id, input, q.hash),
    ]);
    assert.deepEqual(a, b);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM guest_booking_attempt"),
      1,
    );
    await assert.rejects(
      saveGuestAttempt(
        db,
        guest,
        id,
        { ...input, lines: [{ ...input.lines[0], adults: 2 }] },
        q.hash,
      ),
      /idempotency_conflict/,
    );
    await assert.rejects(guestAttempt(db, other, id), /not_found/);
    await assert.rejects(
      saveGuestAttempt(db, other, id, input, q.hash),
      /not_found/,
    );
    await assert.rejects(
      sendGuestAttempt(db, guest, id, false),
      /booking_terms_required/,
    );
    assert.deepEqual((await guestAttempt(db, guest, id)).preview, q);
    const changed = { ...input, lines: [{ ...input.lines[0], adults: 2 }] };
    const changedQuote = await guestQuote(db, guest, changed);
    await assert.rejects(
      submit(db, guest, "guest-request:" + id, changed, changedQuote.hash),
      /booking_conflict/,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 0);
    const [one, two] = await Promise.all([
      sendGuestAttempt(db, guest, id, true),
      sendGuestAttempt(db, guest, id, true),
    ]);
    assert.deepEqual(one, two);
    assert.equal(one.status, "pending");
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 1);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    assert.deepEqual((await guestAttempt(db, guest, id)).receipt, one);
    assert.equal((await guestBooking(db, guest, one.id)).status, "pending");
    await assert.rejects(guestBooking(db, owner, one.id), /not_found/);
    const list = await guestBookings(db, guest);
    assert.equal(list.items.length, 1);
    assert.equal(list.drafts.length, 0);
    await transition(db, guest, "cancel", one.id, "cancel_guest");
    await db
      .prepare("UPDATE place SET publication='paused' WHERE id=?")
      .bind(input.propertyId)
      .run();
    await db
      .prepare("UPDATE nightly_rate SET unit_cents=9900 WHERE room_type_id=?")
      .bind(input.lines[0].roomId)
      .run();
    assert.deepEqual(await sendGuestAttempt(db, guest, id, true), one);
    assert.equal((await guestBooking(db, guest, one.id)).status, "cancelled");
    assert.equal((await guestBooking(db, guest, one.id)).totalCents, 3500);
    assert.equal((await guestBooking(db, guest, one.id)).logistics, null);
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='guest'").run();
    await assert.rejects(
      sendGuestAttempt(db, guest, id, true),
      /verified_session_required/,
    );
  } finally {
    await p.dispose();
  }
});
test("a stale saved quote cannot submit and draft recovery does not invent a new attempt", async () => {
  const p = await database();
  try {
    const db = p.db,
      input = await supply(db),
      q = await guestQuote(db, guest, input),
      id = crypto.randomUUID();
    await saveGuestAttempt(db, guest, id, input, q.hash);
    assert.equal((await guestBookings(db, guest)).drafts[0].id, id);
    await db
      .prepare("UPDATE nightly_rate SET unit_cents=3600 WHERE room_type_id=?")
      .bind(input.lines[0].roomId)
      .run();
    await assert.rejects(
      sendGuestAttempt(db, guest, id, true),
      /quote_changed/,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 0);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE key=?",
        "guest-request:" + id,
      ),
      0,
    );
    assert.equal((await guestAttempt(db, guest, id)).preview.totalCents, 3500);
    await assert.rejects(
      db
        .prepare("UPDATE guest_booking_attempt SET quote_hash=? WHERE id=?")
        .bind("0".repeat(64), id)
        .run(),
      /immutable_attempt/,
    );
  } finally {
    await p.dispose();
  }
});
test("guest collections use stable bounded cursors, verified identity and exclude building/other guest records", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db);
    for (let i = 0; i < 21; i++) await request(db, input, "list:" + i);
    const first = await guestBookings(db, guest);
    assert.equal(first.items.length, 20);
    assert.ok(first.nextCursor);
    const last = await guestBookings(db, guest, first.nextCursor);
    assert.equal(last.items.length, 1);
    assert.equal(last.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...last.items].map((x) => x.id)).size,
      21,
    );
    assert.equal((await guestBookings(db, other)).items.length, 0);
    for (const bad of [1, "x", "1:bad/id", "1:x:extra"])
      await assert.rejects(guestBookings(db, guest, bad), /invalid_request/);
    await assert.rejects(
      guestBookings(db, unverified),
      /verified_session_required/,
    );
  } finally {
    await p.dispose();
  }
});
test("populated 0012 upgrade preserves booking receipts/history and never fabricates terms or attempts", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(
      db,
      env.TEST_MIGRATIONS.filter((x) => x.name < "0013").map((x) => x.name),
    );
    const { input } = await catalog(db),
      receipt = await request(db, input, "prior");
    const tables = [
      "booking",
      "booking_line",
      "booking_night",
      "booking_event",
      "operation",
      "notification_outbox",
    ];
    const before = await Promise.all(
      tables.map(
        async (t) =>
          (await db.prepare("SELECT * FROM " + t + " ORDER BY rowid").all())
            .results,
      ),
    );
    await migrate(db);
    await migrate(db);
    assert.deepEqual(
      await Promise.all(
        tables.map(
          async (t) =>
            (await db.prepare("SELECT * FROM " + t + " ORDER BY rowid").all())
              .results,
        ),
      ),
      before,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM guest_booking_attempt"),
      0,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_terms_document"),
      0,
    );
    assert.deepEqual(await request(db, input, "prior"), receipt);
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});
