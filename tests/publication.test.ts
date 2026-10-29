import { env } from "cloudflare:workers";
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  database,
  migrate,
  catalog,
  owner,
  other,
  guest,
  unverified,
  scalar,
  request,
} from "./support";
import {
  createPropertyDraft,
  updatePropertyDraft,
} from "@root-of-cambodia/backend/property-drafts";
import {
  ownerReviewAction,
  decideReview,
  readReviewPreview,
} from "@root-of-cambodia/backend/publication";
import {
  ownerPublication,
  reviewQueue,
  reviewDetails,
  readSnapshot,
  reviewConfig,
} from "@root-of-cambodia/backend/publication-queries";
import { savePropertyInformation } from "@root-of-cambodia/backend/property-information";
import { savePropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { createRoomType } from "@root-of-cambodia/backend/room-types";
import { preparePhoto } from "@root-of-cambodia/backend/media";
import { completeMedia } from "@root-of-cambodia/backend/media-persistence";
import { mediaKeys } from "@root-of-cambodia/backend/media-queries";
import { readBooking } from "@root-of-cambodia/backend/access";
const fields = {
  ownerName: "Owner",
  nameKm: "ផ្ទះ",
  nameEn: "House",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours",
};
async function configure(db: D1Database, terms: string | null = null) {
  await db
    .prepare("INSERT INTO pilot_publication_config VALUES(1,'other',?,1)")
    .bind(terms)
    .run();
}
async function setup(db: D1Database, configured = true) {
  await catalog(db);
  if (configured) await configure(db);
  return (await createPropertyDraft(db, owner, "draft", fields)).id;
}
const submit = (
  db: D1Database,
  id: string,
  key = "submit",
  propertyRevision = 1,
) =>
  ownerReviewAction(db, owner, key, id, {
    action: "submit",
    propertyRevision,
  });
const decide = async (
  db: D1Database,
  id: string,
  action = "return_changes",
  key: string = crypto.randomUUID(),
  reason = "Add useful directions.",
  revision = 1,
) =>
  decideReview(db, other, key, id, {
    action,
    revision,
    reason,
    configRevision: (await reviewConfig(db))!.revision,
  });
function beforeBatch(
  db: D1Database,
  action: () => Promise<unknown>,
  after = false,
) {
  let first = true;
  return new Proxy(db, {
    get(target, key) {
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          if (first && !after) {
            first = false;
            await action();
          }
          const result = await target.batch(statements);
          if (first && after) {
            first = false;
            await action();
          }
          return result;
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
test("review starts closed, names one verified reviewer, and scopes private reads and decisions", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db, false);
    assert.equal(
      (await ownerPublication(db, owner, id)).reviewerConfigured,
      false,
    );
    await assert.rejects(submit(db, id), /reviewer_not_configured/);
    for (const actor of [owner, guest]) {
      await assert.rejects(reviewQueue(db, actor), /not_found/);
      await assert.rejects(
        ownerPublication(db, actor === owner ? other : guest, id),
        /not_found/,
      );
    }
    await assert.rejects(
      reviewQueue(db, unverified),
      /verified_session_required/,
    );
    await configure(db);
    await assert.rejects(configure(db), /constraint/i);
    const receipt = await submit(db, id);
    assert.equal(receipt.status, "pending");
    assert.equal((await reviewQueue(db, other)).items[0].id, receipt.id);
    assert.equal(
      (await reviewDetails(db, other, receipt.id)).request.snapshot.property.id,
      id,
    );
    await assert.rejects(
      decideReview(db, owner, "forged", receipt.id, {
        action: "approve",
        revision: 1,
      }),
      /not_found/,
    );
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='other'").run();
    await assert.rejects(
      reviewDetails(db, other, receipt.id),
      /verified_session_required/,
    );
  } finally {
    await p.dispose();
  }
});
test("submission snapshots saved details, freezes editing and retains the original receipt after withdrawal", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    await savePropertyInformation(db, owner, "info", id, {
      description: "By the river",
      address: "Kampot",
      facilities: ["Parking"],
      revision: null,
    });
    await savePropertyLogistics(db, owner, "contact", id, {
      latitude: 10,
      longitude: 104,
      contactName: "Reception",
      contactPhone: "123",
      contactEmail: "",
      arrivalInstructions: "Turn left",
      revision: null,
    });
    const snapshot = (await readSnapshot(db, id, owner.id)).data;
    const receipt = await submit(db, id);
    const data = await ownerPublication(db, owner, id);
    assert.equal(data.publication, "review");
    assert.deepEqual(data.latest!.snapshot, snapshot);
    assert.equal(data.events.length, 1);
    const { ownerName: _, ...edit } = fields;
    await assert.rejects(
      updatePropertyDraft(db, owner, "edit", id, {
        ...edit,
        revision: 1,
      }),
      /booking_conflict/,
    );
    await assert.rejects(
      createRoomType(db, owner, "room", id, {
        name: "Room",
        adultCapacity: 2,
        childCapacity: 0,
        totalCapacity: 2,
      }),
      /booking_conflict/,
    );
    await assert.rejects(
      savePropertyInformation(db, owner, "edit-info", id, {
        description: "Changed",
        address: "",
        facilities: [],
        revision: 1,
      }),
      /booking_conflict/,
    );
    await assert.rejects(
      savePropertyLogistics(db, owner, "edit-contact", id, {
        ...snapshot.logistics,
        revision: 1,
      }),
      /booking_conflict/,
    );
    const withdrawn = await ownerReviewAction(db, owner, "withdraw", id, {
      action: "withdraw",
      requestId: receipt.id,
      revision: 1,
    });
    assert.equal(withdrawn.status, "withdrawn");
    assert.deepEqual(await submit(db, id), receipt);
    assert.equal((await ownerPublication(db, owner, id)).publication, "draft");
    await assert.rejects(submit(db, id, "submit", 2), /idempotency_conflict/);
    await assert.rejects(decide(db, receipt.id), /review_conflict/);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_event"),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("return notes, resubmission and explicit approved terms gate publication without changing booking snapshots", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    const existing = await request(db, {
      propertyId: "p",
      checkin: (await db
        .prepare(
          "SELECT min(night) night FROM nightly_rate WHERE room_type_id='r'",
        )
        .first<{
          night: string;
        }>())!.night,
      checkout: new Date(
        Date.parse(
          (await db
            .prepare(
              "SELECT max(night) night FROM nightly_rate WHERE room_type_id='r'",
            )
            .first<{
              night: string;
            }>())!.night,
        ) + 86400000,
      )
        .toISOString()
        .slice(0, 10),
      termsVersion: "terms-v1",
      lines: [
        {
          roomId: "r",
          quantity: 1,
          adults: 1,
          children: 0,
        },
      ],
    });
    const booking = await readBooking(db, guest, existing.id),
      stock = (
        await db
          .prepare("SELECT * FROM inventory_night ORDER BY room_type_id,night")
          .all()
      ).results;
    const first = await submit(db, id);
    await assert.rejects(
      decide(db, first.id, "return_changes", "blank", " "),
      /invalid_review/,
    );
    await assert.rejects(
      decide(db, first.id, "approve"),
      /publication_terms_not_configured/,
    );
    await decide(db, first.id);
    assert.equal(
      (await ownerPublication(db, owner, id)).events.at(-1)!.reason,
      "Add useful directions.",
    );
    await assert.rejects(
      decide(db, first.id, "approve"),
      /publication_terms_not_configured/,
    );
    const next = await submit(db, id, "resubmit");
    assert.notEqual(first.id, next.id);
    await db
      .prepare(
        "UPDATE pilot_publication_config SET terms_version='pilot-approved-v1',revision=revision+1 WHERE singleton=1",
      )
      .run();
    const approved = await decide(
      db,
      next.id,
      "approve",
      "approve",
      "Reviewed",
    );
    assert.equal(approved.status, "approved");
    assert.deepEqual(
      await decide(db, next.id, "approve", "approve", "Reviewed"),
      approved,
    );
    const current = await ownerPublication(db, owner, id);
    assert.equal(current.publication, "published");
    assert.equal(current.latest!.approvedTermsVersion, "pilot-approved-v1");
    assert.equal(
      (await db
        .prepare("SELECT terms_version v FROM property WHERE id=?")
        .bind(id)
        .first<{
          v: string;
        }>())!.v,
      "pilot-approved-v1",
    );
    assert.equal((await reviewQueue(db, other)).items.length, 0);
    assert.deepEqual(await readBooking(db, guest, existing.id), booking);
    assert.deepEqual(
      (
        await db
          .prepare("SELECT * FROM inventory_night ORDER BY room_type_id,night")
          .all()
      ).results,
      stock,
    );
    await db
      .prepare(
        "UPDATE pilot_publication_config SET reviewer_user_id='guest',revision=revision+1",
      )
      .run();
    await assert.rejects(
      decide(db, next.id, "approve", "approve", "Reviewed"),
      /not_found/,
    );
  } finally {
    await p.dispose();
  }
});
test("same-key concurrency and response loss recover one submission and one decision", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    const receipts = await Promise.all([submit(db, id), submit(db, id)]);
    assert.deepEqual(receipts[0], receipts[1]);
    const flaky = beforeBatch(
      db,
      async () => {
        throw new Error("Lost response after commit");
      },
      true,
    );
    const result = await decide(
      flaky,
      receipts[0].id,
      "return_changes",
      "lost",
    );
    assert.deepEqual(
      await decide(db, receipts[0].id, "return_changes", "lost"),
      result,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_command"),
      2,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_event"),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("submission compares the full snapshot and guards ownership, verification and reviewer availability atomically", async () => {
  for (const change of [
    "information",
    "room",
    "owner",
    "verified",
    "reviewer",
  ]) {
    const p = await database();
    try {
      const db = p.db,
        id = await setup(db);
      const raced = beforeBatch(db, async () => {
        if (change === "information")
          await savePropertyInformation(db, owner, "winner", id, {
            description: "Changed",
            address: "",
            facilities: [],
            revision: null,
          });
        else if (change === "room")
          await createRoomType(db, owner, "winner", id, {
            name: "Added",
            adultCapacity: 1,
            childCapacity: 0,
            totalCapacity: 1,
          });
        else if (change === "owner")
          await db
            .prepare("UPDATE property SET owner_id='other' WHERE id=?")
            .bind(id)
            .run();
        else
          await db
            .prepare("UPDATE user SET emailVerified=0 WHERE id=?")
            .bind(change === "verified" ? "owner" : "other")
            .run();
      });
      await assert.rejects(submit(raced, id), /review_conflict/);
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM property_review_command"),
        0,
      );
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM property_review_request"),
        0,
      );
      assert.equal(
        (await db
          .prepare("SELECT publication FROM place WHERE id=?")
          .bind(id)
          .first<{
            publication: string;
          }>())!.publication,
        "draft",
      );
    } finally {
      await p.dispose();
    }
  }
});
test("decision races and stale versions cannot publish or leave partial history", async () => {
  for (const change of [
    "config",
    "terms",
    "owner",
    "verified",
    "ownerVerified",
    "withdraw",
  ]) {
    const p = await database();
    try {
      const db = p.db,
        id = await setup(db);
      const pending = await submit(db, id);
      await db
        .prepare(
          "UPDATE pilot_publication_config SET terms_version='approved-v1',revision=revision+1",
        )
        .run();
      const raced = beforeBatch(db, async () => {
        if (change === "config" || change === "terms")
          await db
            .prepare(
              "UPDATE pilot_publication_config SET reviewer_user_id=?,terms_version=?,revision=revision+1",
            )
            .bind(
              change === "config" ? "guest" : "other",
              change === "terms" ? null : "approved-v1",
            )
            .run();
        else if (change === "owner")
          await db
            .prepare("UPDATE property SET owner_id='other' WHERE id=?")
            .bind(id)
            .run();
        else if (change === "withdraw")
          await ownerReviewAction(db, owner, "withdraw", id, {
            action: "withdraw",
            requestId: pending.id,
            revision: 1,
          });
        else
          await db
            .prepare("UPDATE user SET emailVerified=0 WHERE id=?")
            .bind(change === "verified" ? "other" : "owner")
            .run();
      });
      await assert.rejects(
        decide(raced, pending.id, "approve", "loser"),
        /review_conflict/,
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM property_review_command WHERE key='loser'",
        ),
        0,
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM property_review_event WHERE action='approve'",
        ),
        0,
      );
      assert.equal(
        (await db
          .prepare("SELECT terms_version v FROM property WHERE id=?")
          .bind(id)
          .first<{
            v: string;
          }>())!.v,
        "unconfigured",
      );
    } finally {
      await p.dispose();
    }
  }
});
test("competing owner/reviewer transitions have one winner with complete history", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db),
      pending = await submit(db, id);
    const results = await Promise.allSettled([
      decide(db, pending.id),
      ownerReviewAction(db, owner, "withdraw", id, {
        action: "withdraw",
        requestId: pending.id,
        revision: 1,
      }),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_event"),
      2,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_command"),
      2,
    );
  } finally {
    await p.dispose();
  }
});
test("pending photo uploads block submission and review previews stay private and processed", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    const photo = await preparePhoto(db, owner, "photo", id, {
      contentType: "image/jpeg",
      byteSize: 4,
      sha256: "a".repeat(64),
      revision: null,
    });
    await assert.rejects(submit(db, id), /unfinished_photos/);
    await completeMedia(db, owner, "complete", id, photo.id, 10, 10);
    const keys = mediaKeys({
      id: photo.id,
      property_id: id,
    });
    await env.MEDIA.put(keys.original, "private original");
    await env.MEDIA.put(keys.preview, "processed preview");
    const pending = await submit(db, id);
    for (const actor of [owner, other])
      assert.equal(
        await new Response(
          await readReviewPreview(db, env.MEDIA, actor, pending.id, photo.id),
        ).text(),
        "processed preview",
      );
    await assert.rejects(
      readReviewPreview(db, env.MEDIA, guest, pending.id, photo.id),
      /not_found/,
    );
    await assert.rejects(
      readReviewPreview(db, env.MEDIA, other, pending.id, "other-photo"),
      /not_found/,
    );
    const store = {
      get: async (key: string) => {
        const result = await env.MEDIA.get(key);
        await db
          .prepare(
            "UPDATE pilot_publication_config SET reviewer_user_id='guest',revision=revision+1",
          )
          .run();
        return result;
      },
    } as Pick<R2Bucket, "get">;
    await assert.rejects(
      readReviewPreview(db, store, other, pending.id, photo.id),
      /not_found/,
    );
    await ownerReviewAction(db, owner, "withdraw", id, {
      action: "withdraw",
      requestId: pending.id,
      revision: 1,
    });
    await assert.rejects(
      readReviewPreview(db, env.MEDIA, owner, pending.id, photo.id),
      /not_found/,
    );
  } finally {
    await p.dispose();
  }
});
test("history failure rolls back submission and immutable receipts, snapshots and events reject tampering", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    await db
      .prepare(
        "CREATE TRIGGER fail_review BEFORE INSERT ON property_review_event BEGIN SELECT RAISE(ABORT,'invalid_test_history'); END",
      )
      .run();
    await assert.rejects(submit(db, id), /review_conflict/);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_command"),
      0,
    );
    assert.equal((await ownerPublication(db, owner, id)).publication, "draft");
    await db.prepare("DROP TRIGGER fail_review").run();
    const pending = await submit(db, id);
    for (const sql of [
      "UPDATE property_review_command SET fingerprint='forged'",
      "DELETE FROM property_review_command",
      "UPDATE property_review_request SET snapshot_json='{}'",
      "DELETE FROM property_review_request",
      "UPDATE property_review_event SET actor_id='guest'",
      "DELETE FROM property_review_event",
    ])
      await assert.rejects(
        db.prepare(sql).run(),
        /immutable_|invalid_review_transition/,
      );
    await assert.rejects(
      decideReview(db, other, "bad", pending.id, {
        action: "return_changes",
        revision: 0,
        reason: "fix",
      }),
      /invalid_review/,
    );
    await assert.rejects(
      decideReview(db, other, "bad", pending.id, {
        action: "approve",
        revision: 1,
        publication: "published",
      }),
      /invalid_review/,
    );
    for (const action of [["approve"], ["return_changes"], null, {}, 1])
      await assert.rejects(
        decideReview(db, other, "invalid-action", pending.id, {
          action,
          revision: 1,
          configRevision: 1,
          reason: "Fix",
        }),
        /invalid_review/,
      );
    await assert.rejects(reviewQueue(db, other, "-1"), /invalid_request/);
  } finally {
    await p.dispose();
  }
});
test("populated upgrade preserves all earlier tables and receipts; reviewer configuration starts empty", async () => {
  const p = await database({
    migrate: false,
  });
  try {
    const db = p.db;
    await migrate(
      db,
      env.TEST_MIGRATIONS.filter(
        (m) => m.name !== "0011_property_publication_review.sql",
      ).map((m) => m.name),
    );
    const id = await setup(db, false);
    const tables = (
      await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND substr(name,1,1)!='_' AND name!='d1_migrations' ORDER BY name",
        )
        .all<{
          name: string;
        }>()
    ).results;
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const { name } of tables)
        result[name] = (
          await db.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all()
        ).results;
      return result;
    };
    const before = await snapshot();
    await migrate(db);
    assert.deepEqual(await snapshot(), before);
    for (const table of [
      "pilot_publication_config",
      "property_review_command",
      "property_review_request",
      "property_review_event",
    ])
      assert.equal(await scalar(db, "SELECT count(*) n FROM " + table), 0);
    assert.equal(await reviewConfig(db), null);
    assert.deepEqual(await createPropertyDraft(db, owner, "draft", fields), {
      id,
      status: "draft",
    });
    await configure(db);
    await submit(db, id);
  } finally {
    await p.dispose();
  }
});
test("approval rejects a changed submitted snapshot and owners cannot replay after losing current access", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    const pending = await submit(db, id);
    await db
      .prepare(
        "UPDATE pilot_publication_config SET terms_version='approved-v1',revision=revision+1",
      )
      .run();
    await db
      .prepare("UPDATE place SET name_en='Changed after submission' WHERE id=?")
      .bind(id)
      .run();
    await assert.rejects(decide(db, pending.id, "approve"), /review_conflict/);
    assert.equal((await ownerPublication(db, owner, id)).publication, "review");
    await decide(db, pending.id);
    await db.prepare("UPDATE user SET emailVerified=0 WHERE id='owner'").run();
    await assert.rejects(submit(db, id), /verified_session_required/);
    await db.prepare("UPDATE user SET emailVerified=1 WHERE id='owner'").run();
    await db
      .prepare("UPDATE property SET owner_id='other' WHERE id=?")
      .bind(id)
      .run();
    await assert.rejects(submit(db, id), /not_found/);
  } finally {
    await p.dispose();
  }
});
test("review queue pagination is stable, bounded and hides withdrawn requests", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    await configure(db);
    const ids: string[] = [];
    for (let i = 0; i < 21; i++) {
      const draft = await createPropertyDraft(db, owner, "draft-" + i, fields);
      ids.push((await submit(db, draft.id, "submit-" + i)).id);
    }
    const first = await reviewQueue(db, other);
    assert.deepEqual(
      first.items.map((x) => x.id),
      ids.slice(0, 20),
    );
    assert.ok(first.nextCursor);
    const last = await reviewQueue(db, other, first.nextCursor!);
    assert.deepEqual(
      last.items.map((x) => x.id),
      ids.slice(20),
    );
    assert.equal(last.nextCursor, null);
    const record = (await reviewDetails(db, other, ids[0])).request;
    await ownerReviewAction(db, owner, "withdraw", record.propertyId, {
      action: "withdraw",
      requestId: record.id,
      revision: 1,
    });
    assert.equal((await reviewQueue(db, other)).items.length, 20);
  } finally {
    await p.dispose();
  }
});

test("a changed terms configuration requires reloading the displayed reviewer decision before approval", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    const pending = await submit(db, id);
    await db
      .prepare(
        "UPDATE pilot_publication_config SET terms_version='approved-v1',revision=revision+1",
      )
      .run();
    const displayed = await reviewDetails(db, other, pending.id);
    await db
      .prepare(
        "UPDATE pilot_publication_config SET terms_version='approved-v2',revision=revision+1",
      )
      .run();
    await assert.rejects(
      decideReview(db, other, "stale-terms", pending.id, {
        action: "approve",
        revision: 1,
        configRevision: displayed.configRevision,
      }),
      /review_conflict/,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM property_review_command WHERE key='stale-terms'",
      ),
      0,
    );
    assert.equal((await ownerPublication(db, owner, id)).publication, "review");
    const refreshed = await reviewDetails(db, other, pending.id);
    await decideReview(db, other, "current-terms", pending.id, {
      action: "approve",
      revision: 1,
      configRevision: refreshed.configRevision,
    });
    assert.equal(
      (await ownerPublication(db, owner, id)).latest!.approvedTermsVersion,
      "approved-v2",
    );
  } finally {
    await p.dispose();
  }
});
