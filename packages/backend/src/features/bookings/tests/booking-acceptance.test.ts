import {atScheduledArrival} from "../../../testing/stay-fixtures";
import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import {
  database,
  catalog,
  request,
  guest,
  owner,
  other,
  unverified,
  scalar,
  migrate,
} from "../../../testing/support";
import { transition } from "@root-of-cambodia/backend/bookings";
import { acceptancePreview } from "@root-of-cambodia/backend/bookings";
import { guestBooking } from "@root-of-cambodia/backend/bookings";
import {
  ownerBookings,
  ownerBooking,
  saveOwnerAttempt,
  ownerAttempt,
  applyOwnerAttempt,
} from "@root-of-cambodia/backend/bookings";
import { operate, finish } from "@root-of-cambodia/backend/shared";
import { ensureAcceptanceFixture, testTransition } from "../../../testing/booking-fixtures";
const accept = async (db: D1Database, id: string, key = crypto.randomUUID()) =>
  transition(
    db,
    owner,
    key,
    id,
    "accept",
    undefined,
    (await acceptancePreview(db, owner, id)).hash,
  );
async function base(db: D1Database) {
  const { input } = await catalog(db);
  await ensureAcceptanceFixture(db, "p");
  return input;
}
test("new acceptance requires explicit matching complete preview and saves an immutable private copy atomically", async () => {
  const p = await database();
  try {
    const db = p.db,
      input = await base(db),
      r = await request(db, input),
      preview = await acceptancePreview(db, owner, r.id);
    assert.equal(preview.ready, true);
    await assert.rejects(
      transition(db, owner, "missing", r.id, "accept"),
      /acceptance_preview_required/,
    );
    await assert.rejects(
      transition(db, owner, "wrong", r.id, "accept", undefined, "0".repeat(64)),
      /acceptance_preview_changed/,
    );
    await assert.rejects(acceptancePreview(db, other, r.id), /not_found/);
    await assert.rejects(
      acceptancePreview(db, unverified, r.id),
      /verified_session_required/,
    );
    assert.equal((await guestBooking(db, guest, r.id)).logistics, null);
    await db
      .prepare(
        "UPDATE property_logistics SET contact_email='',revision=revision+1 WHERE property_id='p'",
      )
      .run();
    assert.equal((await acceptancePreview(db, owner, r.id)).ready, false);
    await assert.rejects(accept(db, r.id), /acceptance_incomplete/);
    await db
      .prepare(
        "UPDATE property_logistics SET contact_email='fixture@example.invalid',revision=revision+1 WHERE property_id='p'",
      )
      .run();
    const receipt = await accept(db, r.id);
    assert.equal(receipt.status, "confirmed");
    const confirmed = await guestBooking(db, guest, r.id);
    assert.equal(confirmed.logistics!.address, "Synthetic fixture address");
    assert.equal(confirmed.logistics!.contactEmail, "fixture@example.invalid");
    for (const secret of [
      '"ownerId"',
      '"owner_id"',
      '"preview_hash"',
      '"operation_id"',
      '"information_revision"',
    ])
      assert.ok(!JSON.stringify(confirmed.logistics).includes(secret));
    await assert.rejects(
      db.prepare("UPDATE booking_acceptance SET details_json='{}'").run(),
      /immutable_acceptance/,
    );
    await db
      .prepare(
        "UPDATE property_information SET address_text='New address',revision=revision+1 WHERE property_id='p'",
      )
      .run();
    await db
      .prepare(
        "UPDATE property_logistics SET arrival_instructions='New instructions',revision=revision+1 WHERE property_id='p'",
      )
      .run();
    await db
      .prepare("UPDATE place SET publication='paused' WHERE id='p'")
      .run();
    assert.deepEqual(
      (await guestBooking(db, guest, r.id)).logistics,
      confirmed.logistics,
    );
    const owned = await ownerBooking(db, owner, "p", r.id);
    assert.deepEqual(owned.saved, confirmed.logistics);
    await transition(db, guest, "cancel", r.id, "cancel_guest");
    assert.equal((await guestBooking(db, guest, r.id)).logistics, null);
    assert.equal(
      (await ownerBooking(db, owner, "p", r.id)).saved!.address,
      "Synthetic fixture address",
    );
  } finally {
    await p.dispose();
  }
});
test("last-room acceptance race creates only one copy and a later-night failure leaves no partial snapshot or stock", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db, 1);
    await ensureAcceptanceFixture(db, "p");
    const [a, b] = await Promise.all([
      request(db, input, "a"),
      request(db, input, "b"),
    ]);
    const results = await Promise.allSettled([
      accept(db, a.id),
      accept(db, b.id),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_acceptance"),
      1,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
  } finally {
    await p.dispose();
  }
  const q = await database();
  try {
    const db = q.db,
      input = await base(db),
      r = await request(db, input);
    await db
      .prepare(
        "UPDATE inventory_night SET capacity=0 WHERE room_type_id='r' AND night=?",
      )
      .bind(input.checkout.slice(0, 10))
      .run();
    // Occupied last night, not checkout: verify full rollback after the first night could allocate.
    const last = new Date(Date.parse(input.checkout) - 86400000)
      .toISOString()
      .slice(0, 10);
    await db
      .prepare(
        "UPDATE inventory_night SET capacity=0 WHERE room_type_id='r' AND night=?",
      )
      .bind(last)
      .run();
    await assert.rejects(accept(db, r.id), /booking_conflict/);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_acceptance"),
      0,
    );
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      0,
    );
    assert.equal((await guestBooking(db, guest, r.id)).status, "pending");
  } finally {
    await q.dispose();
  }
});
test("saved owner response recovers lost results after later changes and refuses altered payloads or revoked ownership", async () => {
  const p = await database();
  try {
    const db = p.db,
      input = await base(db),
      r = await request(db, input),
      id = crypto.randomUUID(),
      preview = await acceptancePreview(db, owner, r.id),
      body = { action: "accept", acceptanceHash: preview.hash };
    await saveOwnerAttempt(db, owner, r.id, id, body);
    await saveOwnerAttempt(db, owner, r.id, id, body);
    await assert.rejects(
      saveOwnerAttempt(db, owner, r.id, id, { action: "decline" }),
      /idempotency_conflict/,
    );
    await assert.rejects(ownerAttempt(db, other, r.id, id), /not_found/);
    const receipt = await applyOwnerAttempt(db, owner, r.id, id);
    assert.equal(receipt.status, "confirmed");
    assert.deepEqual(
      (await ownerAttempt(db, owner, r.id, id)).receipt,
      receipt,
    );
    await transition(db, guest, "guest-cancel", r.id, "cancel_guest");
    await db
      .prepare(
        "UPDATE property_logistics SET contact_email='changed@example.invalid',revision=revision+1 WHERE property_id='p'",
      )
      .run();
    assert.deepEqual(await applyOwnerAttempt(db, owner, r.id, id), receipt);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_acceptance"),
      1,
    );
    await db.prepare("UPDATE property SET owner_id='other' WHERE id='p'").run();
    await assert.rejects(applyOwnerAttempt(db, owner, r.id, id), /not_found/);
  } finally {
    await p.dispose();
  }
});
test("preview and write-time ownership/content races roll back the copy, history, stock and success receipt", async () => {
  for (const mutation of ["version", "owner", "verified", "outbox"]) {
    const p = await database();
    try {
      const db = p.db,
        input = await base(db),
        r = await request(db, input),
        hash = (await acceptancePreview(db, owner, r.id)).hash;
      const counts = async () => [
        await scalar(db, "SELECT count(*) n FROM booking_acceptance"),
        await scalar(db, "SELECT count(*) n FROM operation"),
        await scalar(db, "SELECT count(*) n FROM booking_event"),
        await scalar(db, "SELECT count(*) n FROM notification_outbox"),
        await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      ];
      const before = await counts();
      let first = true;
      if (mutation === "outbox")
        await db
          .prepare(
            "CREATE TRIGGER fail_acceptance_outbox BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT,'invalid_fixture_outbox'); END",
          )
          .run();
      const racing = new Proxy(db, {
        get(target, prop) {
          if (prop === "batch")
            return async (...args: Parameters<D1Database["batch"]>) => {
              if (first) {
                first = false;
                if (mutation === "version")
                  await target
                    .prepare(
                      "UPDATE property_logistics SET arrival_instructions='changed',revision=revision+1 WHERE property_id='p'",
                    )
                    .run();
                if (mutation === "owner")
                  await target
                    .prepare(
                      "UPDATE property SET owner_id='other' WHERE id='p'",
                    )
                    .run();
                if (mutation === "verified")
                  await target
                    .prepare("UPDATE user SET emailVerified=0 WHERE id='owner'")
                    .run();
              }
              return target.batch(...args);
            };
          const value = Reflect.get(target, prop);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await assert.rejects(
        transition(racing, owner, "race", r.id, "accept", undefined, hash),
        /booking_conflict/,
      );
      assert.deepEqual(await counts(), before);
    } finally {
      await p.dispose();
    }
  }
});
test("owner collection/detail is property scoped; cancellation needs a reason and is recoverable with a saved response", async () => {
  const p = await database();
  try {
    const db = p.db,
      input = await base(db),
      r = await request(db, input);
    assert.equal((await ownerBookings(db, owner, "p")).items.length, 1);
    await assert.rejects(ownerBookings(db, other, "p"), /not_found/);
    await assert.rejects(ownerBooking(db, owner, "other", r.id), /not_found/);
    await accept(db, r.id);
    await assert.rejects(
      saveOwnerAttempt(db, owner, r.id, crypto.randomUUID(), {
        action: "cancel_owner",
      }),
      /owner_reason_required/,
    );
    const id = crypto.randomUUID();
    await saveOwnerAttempt(db, owner, r.id, id, {
      action: "cancel_owner",
      reason: "Property cannot host this stay.",
    });
    const result = await applyOwnerAttempt(db, owner, r.id, id);
    assert.equal(result.status, "cancelled");
    assert.deepEqual(await applyOwnerAttempt(db, owner, r.id, id), result);
    assert.equal(
      (await guestBooking(db, guest, r.id)).events.at(-1)!.reason,
      "Property cannot host this stay.",
    );
  } finally {
    await p.dispose();
  }
});
test("populated 0013 upgrade retains historical confirmed bookings and receipts without inventing copies", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(
      db,
      env.TEST_MIGRATIONS.filter((x) => x.name < "0014").map((x) => x.name),
    );
    const { input } = await catalog(db),
      r = await request(db, input);
    const old = await testTransition(
      db,
      owner,
      "legacy-accept",
      r.id,
      "accept",
    );
    const tables = [
      "booking",
      "booking_line",
      "booking_night",
      "allocation",
      "operation",
      "booking_event",
      "notification_outbox",
    ];
    const snapshot = () =>
      Promise.all(
        tables.map(
          async (t) =>
            (await db.prepare("SELECT * FROM " + t + " ORDER BY rowid").all())
              .results,
        ),
      );
    const before = await snapshot();
    await migrate(db);
    await migrate(db);
    assert.deepEqual(await snapshot(), before);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_acceptance"),
      0,
    );
    assert.equal((await guestBooking(db, guest, r.id)).status, "confirmed");
    assert.equal((await guestBooking(db, guest, r.id)).logistics, null);
    assert.deepEqual(
      await transition(db, owner, "legacy-accept", r.id, "accept"),
      old,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM booking_acceptance"),
      0,
    );
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});

test("arrival window and later states do not extend guest logistics visibility", async () => {
  const p = await database();
  try {
    const db = p.db,
      input = await base(db),
      r = await request(db, input);
    await accept(db, r.id);
    await assert.rejects(
      transition(db, owner, "blocked-arrival", r.id, "check_in"),
      /booking_conflict/,
    );
    // Scope the future schedule clock to this synthetic booking.
    await atScheduledArrival(db,r.id);
    await operate(
      db,
      owner,
      "fixture-check-in",
      { kind: "check_in", id: r.id, reason: null },
      (op) => [
        db
          .prepare(
            "UPDATE booking SET status='checked_in',last_operation_id=? WHERE id=?",
          )
          .bind(op, r.id),
        finish(db, op, r.id),
      ],
      "owner",
    );
    assert.equal((await guestBooking(db, guest, r.id)).logistics, null);
    await transition(db, owner, "fixture-complete", r.id, "complete");
    assert.equal((await guestBooking(db, guest, r.id)).logistics, null);
    assert.equal(
      (await ownerBooking(db, owner, "p", r.id)).saved!.address,
      "Synthetic fixture address",
    );
  } finally {
    await p.dispose();
  }
});
