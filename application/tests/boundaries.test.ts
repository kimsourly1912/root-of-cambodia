import { test } from "vitest";
import assert from "node:assert/strict";
import { database, catalog, request, guest, owner, scalar } from "./support";
import { normalize, quote } from "../src/quotes";
import { submit, transition } from "../src/bookings";
import { editInventory } from "../src/inventory";
import { digest } from "../src/operations";

// Exercise public services, not a second implementation of the persistence API.
// The new boundary must retain the pre-refactor normalized fingerprint format.
test("named saves retain fingerprints and replay original receipts after catalog/state changes", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input, days } = await catalog(db, 4);
    const q = await quote(db, owner, input, "external");
    const external = await submit(
      db,
      owner,
      "external",
      input,
      q.hash,
      "external",
    );
    const edit = {
      roomId: "r",
      night: days[0],
      capacity: 5,
      blocked: 1,
      revision: 1,
    };
    const edited = await editInventory(db, owner, "edit", edit);
    const pending = await request(db, input);
    const accepted = await transition(
      db,
      owner,
      "accept",
      pending.id,
      "accept",
    );
    await transition(db, guest, "cancel", pending.id, "cancel_guest");
    for (const [key, payload] of [
      [
        "external",
        {
          kind: "submit",
          source: "external",
          input: normalize(input),
          quoteHash: q.hash,
        },
      ],
      ["edit", { kind: "inventory", input: edit }],
      ["accept", { kind: "accept", id: pending.id, reason: null }],
    ] as const) {
      const stored = await db
        .prepare(
          "SELECT fingerprint FROM operation WHERE principal='user:owner' AND key=?",
        )
        .bind(key)
        .first<{ fingerprint: string }>();
      assert.equal(
        stored?.fingerprint,
        await digest({ role: "owner", payload }),
      );
    }
    const before = await scalar(db, "SELECT count(*) n FROM operation");
    await db
      .prepare("UPDATE place SET publication='paused' WHERE id='p'")
      .run();
    await db
      .prepare("UPDATE property SET policy_text='New policy' WHERE id='p'")
      .run();
    await db.prepare("DELETE FROM nightly_rate").run();
    // No current quote can be formed. Replay must still return its saved result.
    await assert.rejects(
      quote(db, owner, input, "external"),
      /incomplete_rates/,
    );
    assert.deepEqual(
      await submit(db, owner, "external", input, q.hash, "external"),
      external,
    );
    assert.deepEqual(await editInventory(db, owner, "edit", edit), edited);
    assert.deepEqual(
      await transition(db, owner, "accept", pending.id, "accept"),
      accepted,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM operation"), before);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      2,
    );
  } finally {
    await p.dispose();
  }
});

test("service authorization precedes replay of external, transition and inventory receipts", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input, days } = await catalog(db, 4);
    const q = await quote(db, owner, input, "external");
    await submit(db, owner, "external", input, q.hash, "external");
    const pending = await request(db, input);
    await transition(db, owner, "accept", pending.id, "accept");
    const edit = {
      roomId: "r",
      night: days[0],
      capacity: 5,
      blocked: 0,
      revision: 1,
    };
    await editInventory(db, owner, "edit", edit);
    const replays = [
      () => submit(db, owner, "external", input, q.hash, "external"),
      () => transition(db, owner, "accept", pending.id, "accept"),
      () => editInventory(db, owner, "edit", edit),
    ];
    const before = await scalar(db, "SELECT count(*) n FROM operation");
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    for (const replay of replays)
      await assert.rejects(replay(), /verified_session_required/);
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db.prepare("UPDATE property SET owner_id='other' WHERE id='p'").run();
    for (const replay of replays) await assert.rejects(replay(), /not_found/);
    assert.equal(await scalar(db, "SELECT count(*) n FROM operation"), before);
    assert.equal(
      await scalar(db, "SELECT sum(reserved) n FROM inventory_night"),
      4,
    );
  } finally {
    await p.dispose();
  }
});

// Revoke permission after early service checks, just as the persistence batch
// begins. No mutation, success receipt, audit event or notification may survive.
for (const mutation of ["submit", "accept", "inventory"] as const) {
  for (const revoke of ["verification", "ownership"] as const) {
    test(`${mutation} rolls back when ${revoke} is revoked at the save boundary`, async () => {
      const p = await database();
      try {
        const db = p.db,
          { input, days } = await catalog(db);
        const pending = await request(db, input);
        const q = await quote(db, owner, input, "external");
        const counts = async () =>
          Promise.all([
            scalar(db, "SELECT count(*) n FROM booking"),
            scalar(db, "SELECT count(*) n FROM operation"),
            scalar(db, "SELECT count(*) n FROM inventory_event"),
            scalar(db, "SELECT count(*) n FROM allocation"),
            scalar(db, "SELECT count(*) n FROM booking_event"),
            scalar(db, "SELECT count(*) n FROM notification_outbox"),
            scalar(db, "SELECT sum(reserved+blocked) n FROM inventory_night"),
          ]);
        const before = await counts();
        let first = true;
        const racing = new Proxy(db, {
          get(target, prop) {
            if (prop === "batch")
              return async (...args: Parameters<D1Database["batch"]>) => {
                if (first) {
                  first = false;
                  await target
                    .prepare(
                      revoke === "verification"
                        ? "UPDATE user SET emailVerified=0 WHERE id='owner'"
                        : "UPDATE property SET owner_id='other' WHERE id='p'",
                    )
                    .run();
                }
                return target.batch(...args);
              };
            const value = Reflect.get(target, prop);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        const change =
          mutation === "submit"
            ? submit(racing, owner, "race", input, q.hash, "external")
            : mutation === "accept"
              ? transition(racing, owner, "race", pending.id, "accept")
              : editInventory(racing, owner, "race", {
                  roomId: "r",
                  night: days[0],
                  capacity: 2,
                  blocked: 1,
                  revision: 1,
                });
        await assert.rejects(change, /booking_conflict/);
        assert.deepEqual(await counts(), before);
        assert.equal(
          (
            await db
              .prepare("SELECT status FROM booking WHERE id=?")
              .bind(pending.id)
              .first<{ status: string }>()
          )?.status,
          "pending",
        );
      } finally {
        await p.dispose();
      }
    });
  }
}
