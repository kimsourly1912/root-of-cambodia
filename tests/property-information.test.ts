import { test } from "vitest";
import assert from "node:assert/strict";
import {
  database,
  catalog,
  request,
  owner,
  other,
  unverified,
  scalar,
} from "./support";
import { createPropertyDraft } from "@root-of-cambodia/backend/property-drafts";
import { ownerPropertyInformation } from "@root-of-cambodia/backend/property-information-queries";
import { savePropertyInformation } from "@root-of-cambodia/backend/property-information";
import { commitPropertyInformation } from "@root-of-cambodia/backend/property-information-persistence";
import { digest } from "@root-of-cambodia/backend/operations";
import { transition } from "@root-of-cambodia/backend/bookings";
import { readBooking } from "@root-of-cambodia/backend/access";
const base = {
  description: "A calm stay.",
  address: "Village road, Kampot",
  facilities: ["Wi-Fi in common areas", "ចំណតរថយន្ត"],
  revision: null,
};
async function setup(db: D1Database) {
  await catalog(db);
  return (
    await createPropertyDraft(db, owner, "property", {
      ownerName: "Owner",
      nameKm: "ផ្ទះ",
      nameEn: "House",
      province: "Kampot",
      checkinTime: "14:00",
      checkoutTime: "11:00",
      policyText: "Quiet hours.",
    })
  ).id;
}
function save(
  db: D1Database,
  id: string,
  key: string,
  input: Record<string, unknown>,
) {
  return savePropertyInformation(db, owner, key, id, input);
}
test("property information has explicit absence, canonical receipts and its own revision, with blank drafts and stable replays", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    assert.deepEqual(await ownerPropertyInformation(db, owner, id), {
      description: "",
      address: "",
      facilities: [],
      revision: null,
    });
    const receipt = await save(db, id, "information", {
      ...base,
      description: " A calm stay. ",
      address: " Village road, Kampot\n",
      facilities: [" Wi-Fi in common areas ", "ចំណតរថយន្ត"],
    });
    assert.deepEqual(receipt, { id, status: "updated" });
    assert.deepEqual(await ownerPropertyInformation(db, owner, id), {
      ...base,
      revision: 1,
    });
    const stored = await db
      .prepare("SELECT fingerprint FROM operation WHERE key='information'")
      .first<{ fingerprint: string }>();
    assert.equal(
      stored?.fingerprint,
      await digest({
        role: "owner",
        payload: { kind: "property_information", propertyId: id, fields: base },
      }),
    );
    assert.deepEqual(await save(db, id, "information", base), receipt);
    await save(db, id, "edit", {
      ...base,
      address: "New address",
      revision: 1,
    });
    assert.equal((await ownerPropertyInformation(db, owner, id)).revision, 2);
    await save(db, id, "clear", {
      description: "",
      address: "",
      facilities: [],
      revision: 2,
    });
    assert.deepEqual(await ownerPropertyInformation(db, owner, id), {
      description: "",
      address: "",
      facilities: [],
      revision: 3,
    });
    assert.equal(
      await scalar(db, "SELECT revision n FROM property WHERE id=?", id),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM property_information_event WHERE property_id=?",
        id,
      ),
      3,
    );
    await db
      .prepare("UPDATE place SET publication='review' WHERE id=?")
      .bind(id)
      .run();
    assert.deepEqual(await save(db, id, "information", base), receipt);
    await assert.rejects(
      save(db, id, "new-op", { ...base, revision: 3 }),
      /booking_conflict/,
    );
    await assert.rejects(
      save(db, id, "information", { ...base, address: "Different" }),
      /idempotency_conflict/,
    );
  } finally {
    await p.dispose();
  }
});
test("information reads, writes and original receipts require current verification and property ownership", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    await save(db, id, "information", base);
    for (const actor of [other, unverified]) {
      await assert.rejects(
        ownerPropertyInformation(db, actor, id),
        actor === other ? /not_found/ : /verified_session_required/,
      );
      await assert.rejects(
        savePropertyInformation(db, actor, "bad", id, base),
        actor === other ? /not_found/ : /verified_session_required/,
      );
    }
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(
      save(db, id, "information", base),
      /verified_session_required/,
    );
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db
      .prepare("UPDATE property SET owner_id='other' WHERE id=?")
      .bind(id)
      .run();
    await assert.rejects(save(db, id, "information", base), /not_found/);
  } finally {
    await p.dispose();
  }
});
test("competing first saves and competing versioned edits cannot overwrite one another or retain losing receipts/history", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    const creates = await Promise.allSettled(
      ["A", "B"].map((description) =>
        save(db, id, "create-" + description, { ...base, description }),
      ),
    );
    assert.equal(creates.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await ownerPropertyInformation(db, owner, id)).revision, 1);
    const edits = await Promise.allSettled(
      ["A", "B"].map((address) =>
        save(db, id, "edit-" + address, { ...base, address, revision: 1 }),
      ),
    );
    assert.equal(edits.filter((x) => x.status === "fulfilled").length, 1);
    const before = await ownerPropertyInformation(db, owner, id);
    assert.equal(before.revision, 2);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_information_event"),
      2,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='property_information'",
      ),
      2,
    );
    await assert.rejects(
      save(db, id, "stale", { ...base, revision: 1 }),
      /booking_conflict/,
    );
    assert.deepEqual(await ownerPropertyInformation(db, owner, id), before);
  } finally {
    await p.dispose();
  }
});
test("same-key races and a lost committed response recover a single complete information save", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    const results = await Promise.all([
      save(db, id, "race", base),
      save(db, id, "race", base),
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
    const edit = { ...base, description: "Changed", revision: 1 };
    const receipt = await save(flaky, id, "lost", edit);
    assert.deepEqual(await save(db, id, "lost", edit), receipt);
    assert.equal((await ownerPropertyInformation(db, owner, id)).revision, 2);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_information_event"),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("write-time owner, verification, publication and expected-absence changes reject the whole information save", async () => {
  for (const change of ["owner", "verification", "publication", "version"]) {
    const p = await database();
    try {
      const db = p.db,
        id = await setup(db);
      let changed = false;
      const concurrent = new Proxy(db, {
        get(target, key) {
          if (key === "batch")
            return async (statements: D1PreparedStatement[]) => {
              if (!changed) {
                changed = true;
                if (change === "version")
                  await save(target, id, "other-save", {
                    ...base,
                    description: "Concurrent save",
                  });
                else {
                  const sql =
                    change === "owner"
                      ? "UPDATE property SET owner_id='other' WHERE id=?"
                      : change === "verification"
                        ? "UPDATE user SET emailVerified=0 WHERE id=?"
                        : "UPDATE place SET publication='review' WHERE id=?";
                  await target
                    .prepare(sql)
                    .bind(change === "verification" ? owner.id : id)
                    .run();
                }
              }
              return target.batch(statements);
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
      await assert.rejects(
        save(concurrent, id, "revoked", base),
        /booking_conflict/,
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM operation WHERE key='revoked'",
        ),
        0,
      );
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM property_information"),
        change === "version" ? 1 : 0,
      );
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM property_information_event"),
        change === "version" ? 1 : 0,
      );
      if (change === "version")
        assert.equal(
          (await ownerPropertyInformation(db, owner, id)).description,
          "Concurrent save",
        );
    } finally {
      await p.dispose();
    }
  }
});
test("audit failure rolls back information and receipt; database guards reject invalid lists, version tampering and forged history", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    await assert.rejects(
      commitPropertyInformation(db, unverified, "unverified", id, base),
      /booking_conflict/,
    );
    await db
      .prepare(
        "CREATE TRIGGER fail_information BEFORE INSERT ON property_information_event BEGIN SELECT RAISE(ABORT,'invalid_test_history'); END",
      )
      .run();
    await assert.rejects(save(db, id, "recover", base), /booking_conflict/);
    assert.equal(
      (await ownerPropertyInformation(db, owner, id)).revision,
      null,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM operation WHERE key='recover'"),
      0,
    );
    await db.prepare("DROP TRIGGER fail_information").run();
    await save(db, id, "recover", base);
    await assert.rejects(
      db
        .prepare(
          "UPDATE property_information SET address_text='Undocumented' WHERE property_id=?",
        )
        .bind(id)
        .run(),
      /invalid_information_revision/,
    );
    await assert.rejects(
      db
        .prepare(
          "UPDATE property_information SET property_id='other',revision=revision+1 WHERE property_id=?",
        )
        .bind(id)
        .run(),
      /invalid_information_revision/,
    );
    await assert.rejects(
      commitPropertyInformation(db, owner, "bad-list", id, {
        ...base,
        revision: 1,
        facilities: [1] as unknown as string[],
      }),
      /booking_conflict/,
    );
    assert.equal((await ownerPropertyInformation(db, owner, id)).revision, 1);
    await assert.rejects(
      db
        .prepare("UPDATE property_information_event SET actor_id='other'")
        .run(),
      /immutable_information_history/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM property_information_event").run(),
      /immutable_information_history/,
    );
    await assert.rejects(
      db
        .prepare(
          "INSERT INTO property_information_event VALUES('forged',?,'other',1,unixepoch())",
        )
        .bind(id)
        .run(),
      /invalid_information_actor/,
    );
  } finally {
    await p.dispose();
  }
});
test("information validation bounds free text and ordered facilities without accepting ownership, coordinates or product policy fields", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    for (const patch of [
      { description: "x".repeat(5001) },
      { address: "x".repeat(1001) },
      { description: "bad\u0000text" },
      { facilities: "Wi-Fi" },
      { facilities: [1] },
      { facilities: [""] },
      { facilities: ["Wi-Fi", " Wi-Fi "] },
      { facilities: ["Wi-Fi\nParking"] },
      { facilities: ["x".repeat(121)] },
      { facilities: Array.from({ length: 31 }, (_, i) => "Facility " + i) },
      { revision: 0 },
      { revision: undefined },
      { ownerId: "other" },
      { publication: "published" },
      { latitude: 10 },
      { phoneVerified: true },
    ])
      await assert.rejects(
        save(db, id, crypto.randomUUID(), { ...base, ...patch }),
        /invalid_property_information/,
      );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='property_information'",
      ),
      0,
    );
    await save(db, id, "text", {
      ...base,
      description: "ស្នាក់នៅ\nText <strong>stays text</strong>",
      address: "Village\nKampot",
      facilities: ["Parking", "Wi-Fi"],
    });
    assert.deepEqual(
      (await ownerPropertyInformation(db, owner, id)).facilities,
      ["Parking", "Wi-Fi"],
    );
  } finally {
    await p.dispose();
  }
});
test("listing information does not change booking settings/revisions, prices, stock, allocations, notifications or retained snapshots", async () => {
  const p = await database();
  try {
    const db = p.db,
      { input } = await catalog(db, 4);
    const booking = await request(db, input);
    await transition(db, owner, "accept", booking.id, "accept");
    const snapshot = await readBooking(db, { id: "guest" }, booking.id);
    const propertyBefore = await db
      .prepare("SELECT * FROM property WHERE id='p'")
      .first();
    const stockBefore = (
      await db
        .prepare("SELECT * FROM inventory_night ORDER BY room_type_id,night")
        .all()
    ).results;
    const ratesBefore = (
      await db
        .prepare("SELECT * FROM nightly_rate ORDER BY room_type_id,night")
        .all()
    ).results;
    const outbox = await scalar(
      db,
      "SELECT count(*) n FROM notification_outbox",
    );
    // Trusted historical fixture: private setup still preserves already recorded bookings.
    await db.prepare("UPDATE place SET publication='draft' WHERE id='p'").run();
    await save(db, "p", "information", base);
    assert.deepEqual(
      await db.prepare("SELECT * FROM property WHERE id='p'").first(),
      propertyBefore,
    );
    assert.deepEqual(
      (
        await db
          .prepare("SELECT * FROM inventory_night ORDER BY room_type_id,night")
          .all()
      ).results,
      stockBefore,
    );
    assert.deepEqual(
      (
        await db
          .prepare("SELECT * FROM nightly_rate ORDER BY room_type_id,night")
          .all()
      ).results,
      ratesBefore,
    );
    assert.deepEqual(
      await readBooking(db, { id: "guest" }, booking.id),
      snapshot,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM allocation WHERE released=0"),
      2,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM notification_outbox"),
      outbox,
    );
  } finally {
    await p.dispose();
  }
});
