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
} from "./support";
import {
  createPropertyDraft,
  updatePropertyDraft,
} from "@root-of-cambodia/backend/property-drafts";
import {
  ownerProperties,
  ownerProperty,
  ownerProfile,
} from "@root-of-cambodia/backend/property-queries";
import {
  commitCreateDraft,
  commitUpdateDraft,
} from "@root-of-cambodia/backend/property-persistence";
const fields = {
  nameKm: "ផ្ទះសំណាក់",
  nameEn: "River House",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours after 22:00.",
};
const create = { ...fields, ownerName: "Local Owner" };
test("verified account creates, reopens and updates a private draft with attributable history and original receipts", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    assert.equal((await ownerProfile(db, guest)).exists, false);
    const r = await createPropertyDraft(db, guest, "create", create);
    assert.equal(r.status, "draft");
    assert.equal((await ownerProfile(db, guest)).displayName, "Local Owner");
    assert.deepEqual(
      (await ownerProperties(db, guest)).items.map((x) => x.id),
      [r.id],
    );
    let draft = await ownerProperty(db, guest, r.id);
    assert.equal(draft.revision, 1);
    assert.equal(draft.publication, "draft");
    const updated = await updatePropertyDraft(db, guest, "edit", r.id, {
      ...fields,
      nameEn: "New name",
      revision: 1,
    });
    draft = await ownerProperty(db, guest, r.id);
    assert.equal(draft.revision, 2);
    assert.equal(draft.nameEn, "New name");
    assert.deepEqual(await createPropertyDraft(db, guest, "create", create), r);
    assert.deepEqual(
      await updatePropertyDraft(db, guest, "edit", r.id, {
        ...fields,
        nameEn: "New name",
        revision: 1,
      }),
      updated,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM property_draft_event WHERE property_id=?",
        r.id,
      ),
      2,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM property WHERE id=? AND terms_version='unconfigured'",
        r.id,
      ),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM room_type WHERE property_id=?",
        r.id,
      ),
      0,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM booking"), 0);
    await assert.rejects(
      createPropertyDraft(db, guest, "create", {
        ...create,
        nameEn: "different",
      }),
      /idempotency_conflict/,
    );
    await createPropertyDraft(db, guest, "second", {
      ...create,
      ownerName: "Not a profile rename",
    });
    assert.equal((await ownerProfile(db, guest)).displayName, "Local Owner");
    const { nameEn: _omitted, ...withoutEnglish } = create;
    const noEnglish = await createPropertyDraft(
      db,
      guest,
      "no-english",
      withoutEnglish,
    );
    assert.equal((await ownerProperty(db, guest, noEnglish.id)).nameEn, "");
    await db
      .prepare("UPDATE place SET publication='review' WHERE id=?")
      .bind(r.id)
      .run();
    assert.deepEqual(
      await updatePropertyDraft(db, guest, "edit", r.id, {
        ...fields,
        nameEn: "New name",
        revision: 1,
      }),
      updated,
    );
  } finally {
    await p.dispose();
  }
});
test("owner queries, writes and receipt replays enforce current verification and ownership", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const r = await createPropertyDraft(db, owner, "create", create);
    for (const actor of [other, guest]) {
      await assert.rejects(ownerProperty(db, actor, r.id), /not_found/);
      await assert.rejects(
        updatePropertyDraft(db, actor, "edit", r.id, {
          ...fields,
          revision: 1,
        }),
        /not_found/,
      );
    }
    await assert.rejects(
      createPropertyDraft(db, unverified, "x", create),
      /verified_session_required/,
    );
    await assert.rejects(
      ownerProperties(db, unverified),
      /verified_session_required/,
    );
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(
      createPropertyDraft(db, owner, "create", create),
      /verified_session_required/,
    );
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db
      .prepare("UPDATE property SET owner_id='other' WHERE id=?")
      .bind(r.id)
      .run();
    await assert.rejects(
      createPropertyDraft(db, owner, "create", create),
      /not_found/,
    );
  } finally {
    await p.dispose();
  }
});
test("parallel saves accept one expected revision and roll back the losing name, history and receipt", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const r = await createPropertyDraft(db, owner, "create", create);
    const results = await Promise.allSettled(
      ["A", "B"].map((nameEn) =>
        updatePropertyDraft(db, owner, "edit-" + nameEn, r.id, {
          ...fields,
          nameEn,
          revision: 1,
        }),
      ),
    );
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal((await ownerProperty(db, owner, r.id)).revision, 2);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM property_draft_event WHERE property_id=?",
        r.id,
      ),
      2,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='property_draft_update'",
      ),
      1,
    );
    const before = await ownerProperty(db, owner, r.id);
    await assert.rejects(
      updatePropertyDraft(db, owner, "stale", r.id, {
        ...fields,
        nameKm: "Overwritten?",
        revision: 1,
      }),
      /booking_conflict/,
    );
    assert.deepEqual(await ownerProperty(db, owner, r.id), before);
    await db
      .prepare("UPDATE place SET publication='published' WHERE id=?")
      .bind(r.id)
      .run();
    await assert.rejects(
      updatePropertyDraft(db, owner, "published", r.id, {
        ...fields,
        revision: 2,
      }),
      /booking_conflict/,
    );
    assert.equal((await ownerProperty(db, owner, r.id)).nameKm, fields.nameKm);
  } finally {
    await p.dispose();
  }
});
test("same-key races and a lost commit response recover exactly one draft", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    const receipts = await Promise.all([
      createPropertyDraft(db, guest, "race", create),
      createPropertyDraft(db, guest, "race", create),
    ]);
    assert.deepEqual(receipts[0], receipts[1]);
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
    const r = await createPropertyDraft(flaky, guest, "lost", create);
    assert.deepEqual(await createPropertyDraft(db, guest, "lost", create), r);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM property WHERE owner_id='guest'",
      ),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("database guards reject invalid draft attribution and failure rolls back every new row", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    await assert.rejects(
      commitCreateDraft(db, unverified, "invalid", create),
      /booking_conflict/,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM place"), 2);
    assert.equal(await scalar(db, "SELECT count(*) n FROM owner_profile"), 2);
    await db
      .prepare(
        "CREATE TRIGGER fail_draft_history BEFORE INSERT ON property_draft_event BEGIN SELECT RAISE(ABORT,'invalid_test_history'); END",
      )
      .run();
    await assert.rejects(
      createPropertyDraft(db, guest, "rollback", create),
      /booking_conflict/,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM place"), 2);
    assert.equal(await scalar(db, "SELECT count(*) n FROM operation"), 0);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM owner_profile WHERE user_id='guest'",
      ),
      0,
    );
    await db.prepare("DROP TRIGGER fail_draft_history").run();
    const r = await createPropertyDraft(db, owner, "valid", create);
    await assert.rejects(
      commitUpdateDraft(db, other, "invalid-owner", r.id, {
        ...fields,
        revision: 1,
      }),
      /booking_conflict/,
    );
    await assert.rejects(
      db.prepare("UPDATE property_draft_event SET kind='updated'").run(),
      /immutable_draft_history/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM property_draft_event").run(),
      /immutable_draft_history/,
    );
    await assert.rejects(
      db
        .prepare(
          "INSERT INTO property_draft_event(operation_id,property_id,actor_id,kind,revision) VALUES('forged',?,'other','updated',2)",
        )
        .bind(r.id)
        .run(),
      /invalid_draft_actor/,
    );
  } finally {
    await p.dispose();
  }
});
test("draft validation rejects injected ownership, publication, invalid clocks and unbounded fields", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    for (const patch of [
      { ownerId: "other" },
      { publication: "published" },
      { nameKm: " " },
      { checkinTime: "24:00" },
      { province: "x".repeat(101) },
      { policyText: "" },
      { termsVersion: "accepted" },
    ])
      await assert.rejects(
        createPropertyDraft(db, owner, crypto.randomUUID(), {
          ...create,
          ...patch,
        }),
        /invalid_property/,
      );
    assert.equal(await scalar(db, "SELECT count(*) n FROM operation"), 0);
  } finally {
    await p.dispose();
  }
});
test("private property pagination returns all own entries without leaking another owner", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    for (let i = 0; i < 21; i++)
      await createPropertyDraft(db, guest, "create-" + i, create);
    const first = await ownerProperties(db, guest);
    assert.equal(first.items.length, 20);
    assert.ok(first.nextCursor);
    const second = await ownerProperties(db, guest, first.nextCursor);
    assert.equal(second.items.length, 1);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((x) => x.id)).size,
      21,
    );
  } finally {
    await p.dispose();
  }
});
