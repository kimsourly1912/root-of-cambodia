import { test } from "vitest";
import assert from "node:assert/strict";
import { database, catalog, owner, other, unverified, scalar } from "../../../testing/support";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import {
  createRoomType,
  updateRoomType,
} from "@root-of-cambodia/backend/rooms";
import {
  ownerRoomType,
  ownerRoomTypes,
} from "@root-of-cambodia/backend/rooms";
import { commitCreateRoomType } from "../room-persistence";
import { digest } from "@root-of-cambodia/backend/shared";
const propertyFields = {
  nameKm: "ផ្ទះសំណាក់",
  nameEn: "House",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours.",
  ownerName: "Owner",
};
const fields = {
  name: "Twin room",
  adultCapacity: 2,
  childCapacity: 1,
  totalCapacity: 3,
};
async function draft(db: D1Database) {
  return (
    await createPropertyDraft(db, owner, crypto.randomUUID(), propertyFields)
  ).id;
}
test("room setup saves its canonical fingerprint, history and original receipts without creating stock or rewriting snapshots", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const propertyId = await draft(db);
    const r = await createRoomType(db, owner, "room", propertyId, {
      ...fields,
      name: " Twin room ",
    });
    assert.equal(r.status, "created");
    const room = await ownerRoomType(db, owner, propertyId, r.id);
    assert.equal(room.name, fields.name);
    assert.equal(room.revision, 1);
    assert.equal(room.active, 1);
    assert.deepEqual(
      await createRoomType(db, owner, "room", propertyId, fields),
      r,
    );
    const stored = await db
      .prepare("SELECT fingerprint FROM operation WHERE key='room'")
      .first<{ fingerprint: string }>();
    assert.equal(
      stored?.fingerprint,
      await digest({
        role: "owner",
        payload: { kind: "room_type_create", propertyId, fields },
      }),
    );
    const edit = { ...fields, name: "Garden twin", revision: 1 };
    const updated = await updateRoomType(
      db,
      owner,
      "edit",
      propertyId,
      r.id,
      edit,
    );
    assert.equal(updated.status, "updated");
    assert.equal(
      (await ownerRoomType(db, owner, propertyId, r.id)).revision,
      2,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM room_type_event WHERE room_type_id=?",
        r.id,
      ),
      2,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM inventory_night WHERE room_type_id=?",
        r.id,
      ),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM nightly_rate WHERE room_type_id=?",
        r.id,
      ),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT revision n FROM property WHERE id=?",
        propertyId,
      ),
      1,
    );
    await db
      .prepare("UPDATE place SET publication='review' WHERE id=?")
      .bind(propertyId)
      .run();
    assert.deepEqual(
      await updateRoomType(db, owner, "edit", propertyId, r.id, edit),
      updated,
    );
    assert.deepEqual(
      await createRoomType(db, owner, "room", propertyId, fields),
      r,
    );
    await assert.rejects(
      createRoomType(db, owner, "published", propertyId, fields),
      /booking_conflict/,
    );
    await assert.rejects(
      updateRoomType(db, owner, "new-edit", propertyId, r.id, {
        ...fields,
        revision: 2,
      }),
      /booking_conflict/,
    );
    await assert.rejects(
      createRoomType(db, owner, "room", propertyId, {
        ...fields,
        name: "Different",
      }),
      /idempotency_conflict/,
    );
  } finally {
    await p.dispose();
  }
});
test("room reads and writes enforce the verified owner and the property-room pair, including receipt recovery", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const propertyId = await draft(db),
      second = await draft(db);
    const r = await createRoomType(db, owner, "room", propertyId, fields);
    await assert.rejects(
      ownerRoomType(db, other, propertyId, r.id),
      /not_found/,
    );
    await assert.rejects(ownerRoomTypes(db, other, propertyId), /not_found/);
    await assert.rejects(
      updateRoomType(db, owner, "wrong-parent", second, r.id, {
        ...fields,
        revision: 1,
      }),
      /not_found/,
    );
    await assert.rejects(ownerRoomType(db, owner, second, r.id), /not_found/);
    await assert.rejects(
      createRoomType(db, other, "not-owner", propertyId, fields),
      /not_found/,
    );
    await assert.rejects(
      createRoomType(db, unverified, "not-verified", propertyId, fields),
      /verified_session_required/,
    );
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(
      createRoomType(db, owner, "room", propertyId, fields),
      /verified_session_required/,
    );
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db
      .prepare("UPDATE property SET owner_id='other' WHERE id=?")
      .bind(propertyId)
      .run();
    await assert.rejects(
      createRoomType(db, owner, "room", propertyId, fields),
      /not_found/,
    );
    await assert.rejects(
      updateRoomType(db, owner, "x", propertyId, r.id, {
        ...fields,
        revision: 1,
      }),
      /not_found/,
    );
  } finally {
    await p.dispose();
  }
});
test("parallel room edits commit one expected revision and retain no losing audit or success receipt", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const propertyId = await draft(db);
    const r = await createRoomType(db, owner, "room", propertyId, fields);
    const results = await Promise.allSettled(
      ["A", "B"].map((name) =>
        updateRoomType(db, owner, "edit-" + name, propertyId, r.id, {
          ...fields,
          name,
          revision: 1,
        }),
      ),
    );
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    const before = await ownerRoomType(db, owner, propertyId, r.id);
    assert.equal(before.revision, 2);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='room_type_update'",
      ),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM room_type_event WHERE room_type_id=?",
        r.id,
      ),
      2,
    );
    await assert.rejects(
      updateRoomType(db, owner, "stale", propertyId, r.id, {
        ...fields,
        revision: 1,
      }),
      /booking_conflict/,
    );
    assert.deepEqual(await ownerRoomType(db, owner, propertyId, r.id), before);
  } finally {
    await p.dispose();
  }
});
test("same-key creation races and a lost commit response recover one room per operation", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const propertyId = await draft(db);
    const results = await Promise.all([
      createRoomType(db, owner, "race", propertyId, fields),
      createRoomType(db, owner, "race", propertyId, fields),
    ]);
    assert.deepEqual(results[0], results[1]);
    let lost = false;
    const flaky = new Proxy(db, {
      get(target, key) {
        if (key === "batch")
          return async (statements: D1PreparedStatement[]) => {
            const result = await target.batch(statements);
            if (!lost) {
              lost = true;
              throw new Error("Response lost after commit");
            }
            return result;
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const r = await createRoomType(flaky, owner, "lost", propertyId, fields);
    assert.deepEqual(
      await createRoomType(db, owner, "lost", propertyId, fields),
      r,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM room_type WHERE property_id=?",
        propertyId,
      ),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("write-time revocation of ownership or verification rolls back both room create and edit", async () => {
  for (const kind of ["create", "edit"]) {
    for (const revoke of ["owner", "verification"]) {
      const p = await database();
      try {
        const db = p.db;
        await catalog(db);
        const propertyId = await draft(db);
        const room =
          kind === "edit"
            ? await createRoomType(db, owner, "seed-room", propertyId, fields)
            : null;
        const counts = () =>
          db
            .prepare(
              "SELECT (SELECT count(*) FROM room_type) rooms,(SELECT count(*) FROM room_type_event) events,(SELECT count(*) FROM operation WHERE kind LIKE 'room_type_%') operations",
            )
            .first();
        const before = await counts();
        let revoked = false;
        const concurrent = new Proxy(db, {
          get(target, key) {
            if (key === "batch")
              return async (statements: D1PreparedStatement[]) => {
                if (!revoked) {
                  revoked = true;
                  await (
                    revoke === "owner"
                      ? target
                          .prepare(
                            "UPDATE property SET owner_id='other' WHERE id=?",
                          )
                          .bind(propertyId)
                      : target.prepare(
                          "UPDATE user SET emailVerified=0 WHERE id='owner'",
                        )
                  ).run();
                }
                return target.batch(statements);
              };
            const value = Reflect.get(target, key);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        await assert.rejects(
          kind === "create"
            ? createRoomType(concurrent, owner, "revoke", propertyId, fields)
            : updateRoomType(
                concurrent,
                owner,
                "revoke",
                propertyId,
                room!.id,
                { ...fields, revision: 1 },
              ),
          /booking_conflict/,
        );
        assert.deepEqual(await counts(), before);
      } finally {
        await p.dispose();
      }
    }
  }
});
test("room history failures roll back the room and receipt, and events reject forged attribution and mutation", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const propertyId = await draft(db);
    await assert.rejects(
      commitCreateRoomType(db, unverified, "invalid", propertyId, fields),
      /booking_conflict/,
    );
    await db
      .prepare(
        "CREATE TRIGGER fail_room_history BEFORE INSERT ON room_type_event BEGIN SELECT RAISE(ABORT,'invalid_test_history'); END",
      )
      .run();
    await assert.rejects(
      createRoomType(db, owner, "rollback", propertyId, fields),
      /booking_conflict/,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM room_type WHERE property_id=?",
        propertyId,
      ),
      0,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='room_type_create'",
      ),
      0,
    );
    await db.prepare("DROP TRIGGER fail_room_history").run();
    const r = await createRoomType(db, owner, "valid", propertyId, fields);
    await assert.rejects(
      db.prepare("UPDATE room_type_event SET kind='updated'").run(),
      /immutable_room_history/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM room_type_event").run(),
      /immutable_room_history/,
    );
    await assert.rejects(
      db
        .prepare(
          "INSERT INTO room_type_event(operation_id,room_type_id,actor_id,kind,revision) VALUES('forged',?,'other','updated',2)",
        )
        .bind(r.id)
        .run(),
      /invalid_room_actor/,
    );
  } finally {
    await p.dispose();
  }
});
test("room validation retains existing capacity bounds without accepting new occupancy or ownership policies", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const propertyId = await draft(db);
    for (const patch of [
      { name: " " },
      { name: "x".repeat(201) },
      { adultCapacity: 0 },
      { adultCapacity: "2" },
      { childCapacity: -1 },
      { childCapacity: 1.5 },
      { totalCapacity: 101 },
      { ownerId: "other" },
      { propertyId: "other" },
      { quantity: 3 },
      { infants: 1 },
      { active: 0 },
    ])
      await assert.rejects(
        createRoomType(db, owner, crypto.randomUUID(), propertyId, {
          ...fields,
          ...patch,
        }),
        /invalid_room_type/,
      );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='room_type_create'",
      ),
      0,
    );
    // Aggregate adult, child and total ceilings remain independent, as in the approved schema.
    await createRoomType(db, owner, "separate-limits", propertyId, {
      ...fields,
      adultCapacity: 2,
      childCapacity: 2,
      totalCapacity: 2,
    });
  } finally {
    await p.dispose();
  }
});
test("room pagination returns every room of the requested owned property and no rooms of another property", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const propertyId = await draft(db),
      second = await draft(db);
    for (let i = 0; i < 21; i++)
      await createRoomType(db, owner, "room-" + i, propertyId, fields);
    await createRoomType(db, owner, "other-property", second, fields);
    const first = await ownerRoomTypes(db, owner, propertyId);
    assert.equal(first.items.length, 20);
    assert.ok(first.nextCursor);
    const last = await ownerRoomTypes(db, owner, propertyId, first.nextCursor);
    assert.equal(last.items.length, 1);
    assert.equal(last.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...last.items].map((x) => x.id)).size,
      21,
    );
    assert.ok(
      [...first.items, ...last.items].every((x) => x.propertyId === propertyId),
    );
  } finally {
    await p.dispose();
  }
});
