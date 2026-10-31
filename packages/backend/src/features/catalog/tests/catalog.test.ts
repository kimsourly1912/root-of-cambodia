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
  scalar,
  request,
} from "../../../testing/support";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import {
  ownerReviewAction,
  decideReview,
} from "@root-of-cambodia/backend/publication";
import {
  ownerPublication,
  readSnapshot,
} from "@root-of-cambodia/backend/publication";
import {
  publicDisclosurePreview,
  PUBLIC_DISCLOSURE_VERSION,
} from "@root-of-cambodia/backend/publication";
import {
  browseStays,
  publicStay,
  readPublicPhoto,
} from "@root-of-cambodia/backend/catalog";
import { savePropertyInformation } from "@root-of-cambodia/backend/property-information";
import { savePropertyLogistics } from "@root-of-cambodia/backend/property-logistics";
import { readyPublicationFixture, disclosureFor } from "../../../testing/publication-fixtures";
import {
  mediaKeys,
  ownerMediaGallery,
} from "@root-of-cambodia/backend/media";
import { preparePhoto, editPhotos } from "@root-of-cambodia/backend/media";
import { completeMedia } from "../../media/media-persistence";
import { digest } from "@root-of-cambodia/backend/shared";
import { submit as submitBooking } from "@root-of-cambodia/backend/bookings";
import { testTransition as transition } from "../../../testing/booking-fixtures";
import { quote } from "@root-of-cambodia/backend/quotes";
import { shiftNight } from "@root-of-cambodia/backend/calendar";

const fields = {
  ownerName: "PRIVATE_OWNER_MARKER",
  nameKm: "ផ្ទះសំណាក់",
  nameEn: "River_100%\\Stay",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours at night.",
};
async function base(db: D1Database) {
  await catalog(db);
  await db
    .prepare(
      "INSERT INTO pilot_publication_config VALUES(1,'other','approved-v1',1)",
    )
    .run();
}
async function draft(db: D1Database, name = fields.nameEn) {
  const { id } = await createPropertyDraft(db, owner, crypto.randomUUID(), {
    ...fields,
    nameEn: name,
  });
  const supply = await readyPublicationFixture(db, owner, id);
  await savePropertyInformation(db, owner, crypto.randomUUID(), id, {
    description: "Public description <script>alert(1)</script>",
    address: "PRIVATE_ADDRESS_MARKER",
    facilities: ["Parking", "Wi-Fi"],
    revision: 1,
  });
  await savePropertyLogistics(db, owner, crypto.randomUUID(), id, {
    latitude: 10.5,
    longitude: 104.5,
    contactName: "PRIVATE_CONTACT_MARKER",
    contactPhone: "PRIVATE_PHONE_MARKER",
    contactEmail: "private-contact@example.invalid",
    arrivalInstructions: "PRIVATE_ARRIVAL_MARKER",
    revision: 1,
  });
  return { id, ...supply };
}
async function submission(db: D1Database, id: string) {
  const state = await ownerPublication(db, owner, id);
  return {
    action: "submit",
    propertyRevision: state.propertyRevision,
    publicDisclosure: {
      version: state.publicPreview!.version,
      previewHash: state.publicPreview!.previewHash,
    },
  };
}
const approve = (db: D1Database, id: string, key = crypto.randomUUID()) =>
  decideReview(db, other, key, id, {
    action: "approve",
    revision: 1,
    configRevision: 1,
  });
async function publish(db: D1Database, id: string) {
  const body = await submission(db, id);
  const pending = await ownerReviewAction(
    db,
    owner,
    crypto.randomUUID(),
    id,
    body,
  );
  await approve(db, pending.id);
  return { pending, body };
}
const forbidden = [
  "PRIVATE_OWNER_MARKER",
  "PRIVATE_ADDRESS_MARKER",
  "PRIVATE_CONTACT_MARKER",
  "PRIVATE_PHONE_MARKER",
  "private-contact@example.invalid",
  "PRIVATE_ARRIVAL_MARKER",
  '"ownerId"',
  '"address"',
  '"latitude"',
  '"longitude"',
  '"arrivalInstructions"',
  '"contactEmail"',
  '"previewHash"',
  '"snapshot"',
  '"configuredNights"',
  '"unitCents"',
  '"sha256"',
  '"width"',
  '"height"',
  "private/properties/",
];
function privateFree(value: unknown) {
  const json = JSON.stringify(value);
  for (const secret of forbidden) assert.ok(!json.includes(secret), secret);
}

test("new submissions require explicit matching public-display authorization and retain immutable proof atomically", async () => {
  const p = await database();
  try {
    const db = p.db;
    await base(db);
    const { id } = await draft(db);
    const body = await submission(db, id);
    const { publicDisclosure: _, ...missing } = body;
    await assert.rejects(
      ownerReviewAction(db, owner, "missing", id, missing),
      /public_disclosure_required/,
    );
    for (const value of [
      true,
      { version: "old", previewHash: "a".repeat(64) },
      { ...body.publicDisclosure, extra: true },
    ])
      await assert.rejects(
        ownerReviewAction(db, owner, "invalid", id, {
          ...body,
          publicDisclosure: value,
        }),
        /invalid_review/,
      );
    await assert.rejects(
      ownerReviewAction(db, owner, "wrong-hash", id, {
        ...body,
        publicDisclosure: {
          ...body.publicDisclosure,
          previewHash: "a".repeat(64),
        },
      }),
      /public_disclosure_changed/,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_command"),
      0,
    );
    const [a, b] = await Promise.all([
      ownerReviewAction(db, owner, "same", id, body),
      ownerReviewAction(db, owner, "same", id, body),
    ]);
    assert.deepEqual(a, b);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM public_listing_disclosure"),
      1,
    );
    const proof = await db
      .prepare("SELECT * FROM public_listing_disclosure WHERE request_id=?")
      .bind(a.id)
      .first<{
        owner_id: string;
        policy_version: string;
        preview_hash: string;
      }>();
    assert.equal(proof!.owner_id, owner.id);
    assert.equal(proof!.policy_version, PUBLIC_DISCLOSURE_VERSION);
    assert.equal(proof!.preview_hash, body.publicDisclosure.previewHash);
    await assert.rejects(
      db
        .prepare("UPDATE public_listing_disclosure SET preview_hash=?")
        .bind("b".repeat(64))
        .run(),
      /immutable_public_disclosure/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM public_listing_disclosure").run(),
      /immutable_public_disclosure/,
    );
    await approve(db, a.id);
    assert.deepEqual(await ownerReviewAction(db, owner, "same", id, body), a);
    await assert.rejects(
      ownerReviewAction(db, owner, "same", id, missing),
      /idempotency_conflict/,
    );
  } finally {
    await p.dispose();
  }
});

test("public preview binds displayed content and photo order while private-only edits do not authorize private fields", async () => {
  const p = await database();
  try {
    const db = p.db;
    await base(db);
    const { id } = await draft(db);
    const old = await submission(db, id);
    await savePropertyInformation(db, owner, "public-edit", id, {
      description: "A new public description",
      address: "PRIVATE_ADDRESS_MARKER",
      facilities: [],
      revision: 2,
    });
    await assert.rejects(
      ownerReviewAction(db, owner, "stale", id, old),
      /public_disclosure_changed/,
    );
    const current = await submission(db, id);
    await savePropertyLogistics(db, owner, "private-edit", id, {
      latitude: null,
      longitude: null,
      contactName: "PRIVATE_CONTACT_MARKER",
      contactPhone: "PRIVATE_PHONE_MARKER",
      contactEmail: "",
      arrivalInstructions: "PRIVATE_ARRIVAL_MARKER",
      revision: 2,
    });
    assert.deepEqual(
      (await submission(db, id)).publicDisclosure,
      current.publicDisclosure,
    );
    const second = await preparePhoto(db, owner, "second-photo", id, {
      contentType: "image/jpeg",
      byteSize: 4,
      sha256: "c".repeat(64),
      revision: (await ownerMediaGallery(db, owner, id)).revision,
    });
    await completeMedia(db, owner, "second-ready", id, second.id, 20, 10);
    const gallery = await ownerMediaGallery(db, owner, id);
    const before = await submission(db, id);
    await editPhotos(db, owner, "reverse", id, {
      action: "reorder",
      ids: gallery.photos.map((photo) => photo.id).reverse(),
      revision: gallery.revision,
    });
    await assert.rejects(
      ownerReviewAction(db, owner, "stale-order", id, before),
      /public_disclosure_changed/,
    );
    await publish(db, id);
    const listing = await publicStay(db, id);
    assert.equal(listing.photos[0].id, second.id);
    assert.equal((await browseStays(db)).items[0].cover!.id, second.id);
    privateFree(listing);
    assert.deepEqual(Object.keys(listing.photos[0]), ["id"]);
  } finally {
    await p.dispose();
  }
});

test("missing disclosure history rolls back state, events and receipts; an uncertain commit recovers one proof", async () => {
  const p = await database();
  try {
    const db = p.db;
    await base(db);
    const { id } = await draft(db),
      body = await submission(db, id);
    await db
      .prepare(
        "CREATE TRIGGER fail_disclosure BEFORE INSERT ON public_listing_disclosure BEGIN SELECT RAISE(ABORT,'invalid_test_disclosure'); END",
      )
      .run();
    await assert.rejects(
      ownerReviewAction(db, owner, "retry", id, body),
      /review_conflict/,
    );
    for (const table of [
      "property_review_request",
      "property_review_command",
      "property_review_event",
      "public_listing_disclosure",
    ])
      assert.equal(await scalar(db, "SELECT count(*) n FROM " + table), 0);
    assert.equal((await ownerPublication(db, owner, id)).publication, "draft");
    await db.prepare("DROP TRIGGER fail_disclosure").run();
    const flaky = new Proxy(db, {
      get(target, key) {
        if (key === "batch")
          return async (statements: D1PreparedStatement[]) => {
            await target.batch(statements);
            throw new Error("Lost acknowledgement");
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const receipt = await ownerReviewAction(flaky, owner, "retry", id, body);
    assert.deepEqual(
      await ownerReviewAction(db, owner, "retry", id, body),
      receipt,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM public_listing_disclosure"),
      1,
    );
  } finally {
    await p.dispose();
  }
});

test("anonymous listing data is an exact allowlist and only an approved authorized property is visible", async () => {
  const p = await database();
  try {
    const db = p.db;
    await base(db);
    const { id } = await draft(db);
    assert.deepEqual((await browseStays(db)).items, []);
    await assert.rejects(publicStay(db, id), /not_found/);
    const state = await ownerPublication(db, owner, id);
    privateFree(state.publicPreview!.listing);
    const pending = await ownerReviewAction(
      db,
      owner,
      "submit",
      id,
      await submission(db, id),
    );
    await assert.rejects(publicStay(db, id), /not_found/);
    await approve(db, pending.id);
    const listing = await publicStay(db, id);
    assert.deepEqual(listing, state.publicPreview!.listing);
    assert.deepEqual(
      Object.keys(listing).sort(),
      [
        "id",
        "nameKm",
        "nameEn",
        "province",
        "description",
        "facilities",
        "checkinTime",
        "checkoutTime",
        "policyText",
        "charges",
        "rooms",
        "photos",
      ].sort(),
    );
    privateFree(listing);
    privateFree(await browseStays(db));
    // The old catalog fixture is published but has no public owner authorization.
    await assert.rejects(publicStay(db, "p"), /not_found/);
    assert.equal((await browseStays(db)).items.length, 1);
    await db
      .prepare(
        "UPDATE pilot_publication_config SET reviewer_user_id='guest',revision=revision+1",
      )
      .run();
    assert.deepEqual(await publicStay(db, id), listing);
  } finally {
    await p.dispose();
  }
});

test("current state, ownership, owner verification and a corrupt confirmation hash fail closed", async () => {
  for (const change of ["paused", "owner", "verified", "hash"]) {
    const p = await database();
    try {
      const db = p.db;
      await base(db);
      const { id } = await draft(db);
      await publish(db, id);
      if (change === "paused")
        await db
          .prepare("UPDATE place SET publication='paused' WHERE id=?")
          .bind(id)
          .run();
      else if (change === "owner")
        await db
          .prepare("UPDATE property SET owner_id='other' WHERE id=?")
          .bind(id)
          .run();
      else if (change === "verified")
        await db
          .prepare("UPDATE user SET emailVerified=0 WHERE id='owner'")
          .run();
      else {
        // Fault injection simulates corrupt stored data, not a production repair.
        await db
          .prepare("DROP TRIGGER public_listing_disclosure_immutable_update")
          .run();
        await db
          .prepare("UPDATE public_listing_disclosure SET preview_hash=?")
          .bind("0".repeat(64))
          .run();
      }
      await assert.rejects(publicStay(db, id), /not_found/);
      assert.deepEqual((await browseStays(db)).items, []);
    } finally {
      await p.dispose();
    }
  }
});

test(
  "search treats wildcards literally, supports Khmer/English, validates bounds and paginates public identifiers",
  { timeout: 30000 },
  async () => {
    const p = await database();
    try {
      const db = p.db;
      await base(db);
      const ids: string[] = [];
      for (let i = 0; i < 21; i++) {
        const { id } = await draft(
          db,
          i === 0 ? fields.nameEn : "Other stay " + i,
        );
        await publish(db, id);
        ids.push(id);
      }
      ids.sort();
      const first = await browseStays(db);
      assert.deepEqual(
        first.items.map((item) => item.id),
        ids.slice(0, 20),
      );
      assert.equal(first.nextCursor, ids[19]);
      const last = await browseStays(db, { cursor: first.nextCursor });
      assert.deepEqual(
        last.items.map((item) => item.id),
        ids.slice(20),
      );
      assert.equal(last.nextCursor, null);
      for (const q of ["_", "%", "\\", "river_", "100%\\"]) {
        assert.equal(
          (await browseStays(db, { q, province: "kampot" })).items.length,
          1,
          q,
        );
      }
      assert.equal((await browseStays(db, { q: "ផ្ទះ" })).items.length, 20);
      assert.equal(
        (await browseStays(db, { q: "' OR 1=1 --" })).items.length,
        0,
      );
      assert.equal(
        (await browseStays(db, { province: "Unknown" })).items.length,
        0,
      );
      for (const input of [
        { q: "x".repeat(101) },
        { q: " ".repeat(101) },
        { q: ["x"] },
        { cursor: "bad=cursor" },
        { province: "\n" },
        { ownerId: "owner" },
      ])
        await assert.rejects(browseStays(db, input), /invalid_request/);
      await db
        .prepare("DROP TRIGGER public_listing_disclosure_immutable_update")
        .run();
      await db
        .prepare(
          "UPDATE public_listing_disclosure SET preview_hash=? WHERE request_id=(SELECT id FROM property_review_request WHERE property_id=?)",
        )
        .bind("0".repeat(64), ids[19])
        .run();
      const filtered = await browseStays(db);
      assert.equal(filtered.nextCursor, ids[18]);
      assert.ok(filtered.items.some((item) => item.id === filtered.nextCursor));
      assert.deepEqual(
        (await browseStays(db, { cursor: filtered.nextCursor })).items.map(
          (item) => item.id,
        ),
        ids.slice(20),
      );
    } finally {
      await p.dispose();
    }
  },
);

test("public photos return only processed approved members and recheck eligibility after storage reads", async () => {
  for (const change of ["none", "paused", "owner", "verified", "removed"]) {
    const p = await database();
    try {
      const db = p.db;
      await base(db);
      const { id, photoId } = await draft(db);
      await publish(db, id);
      const keys = mediaKeys({ id: photoId!, property_id: id });
      await env.MEDIA.put(keys.original, "PRIVATE_ORIGINAL_BYTES");
      await env.MEDIA.put(keys.preview, "SAFE_PREVIEW_BYTES");
      let calls = 0;
      const store = {
        get: async (key: string) => {
          calls++;
          assert.equal(key, keys.preview);
          const object = await env.MEDIA.get(key);
          if (change === "paused")
            await db
              .prepare("UPDATE place SET publication='paused' WHERE id=?")
              .bind(id)
              .run();
          else if (change === "owner")
            await db
              .prepare("UPDATE property SET owner_id='other' WHERE id=?")
              .bind(id)
              .run();
          else if (change === "verified")
            await db
              .prepare("UPDATE user SET emailVerified=0 WHERE id='owner'")
              .run();
          else if (change === "removed")
            await db
              .prepare(
                "UPDATE property_media SET state='removed',cleanup_at=unixepoch() WHERE id=?",
              )
              .bind(photoId)
              .run();
          return object;
        },
      } as Pick<R2Bucket, "get">;
      await assert.rejects(
        readPublicPhoto(db, store, id, "nonmember"),
        /not_found/,
      );
      assert.equal(calls, 0);
      if (change === "none")
        assert.equal(
          await new Response(
            await readPublicPhoto(db, store, id, photoId!),
          ).text(),
          "SAFE_PREVIEW_BYTES",
        );
      else
        await assert.rejects(
          readPublicPhoto(db, store, id, photoId!),
          /not_found/,
        );
    } finally {
      await p.dispose();
    }
  }
});

test("missing processed objects are safe failures and full/aged calendar setup does not remove approved browsing", async () => {
  const p = await database();
  try {
    const db = p.db;
    await base(db);
    const { id, photoId, roomId, night } = await draft(db);
    await publish(db, id);
    await assert.rejects(
      readPublicPhoto(db, env.MEDIA, id, photoId!),
      /photo_processing_unavailable/,
    );
    const input = {
      propertyId: id,
      checkin: night,
      checkout: shiftNight(night, 1),
      termsVersion: "approved-v1",
      lines: [{ roomId, quantity: 1, adults: 1, children: 0 }],
    };
    const quoted = await quote(db, guest, input);
    const booking = await submitBooking(
      db,
      guest,
      "guest-booking",
      input,
      quoted.hash,
    );
    await transition(db, owner, "accept", booking.id, "accept");
    const before = await publicStay(db, id);
    assert.equal((await browseStays(db)).items.length, 1);
    await assert.rejects(quote(db, guest, input), /inventory_unavailable/);
    await db
      .prepare(
        "UPDATE inventory_night SET blocked=capacity-reserved WHERE room_type_id=?",
      )
      .bind(roomId)
      .run();
    assert.deepEqual(await publicStay(db, id), before);
    // Eligibility SQL has no time/readiness predicate: an already-published
    // listing remains public independently of future date coverage.
    assert.equal((await browseStays(db)).items.length, 1);
  } finally {
    await p.dispose();
  }
});

test("populated 0011 upgrade preserves earlier records/receipts without inventing public authorization", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(
      db,
      env.TEST_MIGRATIONS.filter((m) => m.name < "0012").map((m) => m.name),
    );
    await base(db);
    const pendingDraft = await draft(db),
      oldPublished = await draft(db, "Earlier published stay");
    async function legacy(id: string) {
      const snapshot = (await readSnapshot(db, id, owner.id)).json,
        command = crypto.randomUUID();
      const fingerprint = await digest({
        role: "owner",
        payload: { action: "submit", propertyId: id, propertyRevision: 1 },
      });
      await db.batch([
        db
          .prepare(
            "INSERT INTO property_review_command(id,actor_id,actor_role,key,fingerprint,action) VALUES (?,'owner','owner',?,?,'submit')",
          )
          .bind(command, id, fingerprint),
        db.prepare("UPDATE place SET publication='review' WHERE id=?").bind(id),
        db
          .prepare(
            "INSERT INTO property_review_request(id,property_id,owner_id,status,snapshot_json,last_command_id) VALUES (?,?,'owner','pending',?,?)",
          )
          .bind(command, id, snapshot, command),
        db
          .prepare(
            "INSERT INTO property_review_event(command_id,request_id,actor_id,actor_role,action) VALUES (?,?,'owner','owner','submit')",
          )
          .bind(command, command),
        db
          .prepare(
            "UPDATE property_review_command SET result_json=json_object('id',?,'status','pending'),sealed=1 WHERE id=?",
          )
          .bind(command, command),
      ]);
      return command;
    }
    const legacyPending = await legacy(pendingDraft.id);
    // A coherent earlier approved record; no authorization table exists yet.
    const oldRequest = await legacy(oldPublished.id),
      approval = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO property_review_command(id,actor_id,actor_role,key,fingerprint,action) VALUES (?,'other','reviewer','legacy-approve','legacy','approve')",
        )
        .bind(approval),
      db
        .prepare(
          "UPDATE property_review_request SET status='approved',revision=revision+1,last_command_id=?,approved_terms_version='approved-v1' WHERE id=?",
        )
        .bind(approval, oldRequest),
      db
        .prepare("UPDATE property SET terms_version='approved-v1' WHERE id=?")
        .bind(oldPublished.id),
      db
        .prepare("UPDATE place SET publication='published' WHERE id=?")
        .bind(oldPublished.id),
      db
        .prepare(
          "INSERT INTO property_review_event(command_id,request_id,actor_id,actor_role,action) VALUES (?,?,'other','reviewer','approve')",
        )
        .bind(approval, oldRequest),
      db
        .prepare(
          "UPDATE property_review_command SET result_json=json_object('id',?,'status','approved'),sealed=1 WHERE id=?",
        )
        .bind(oldRequest, approval),
    ]);
    const oldBooking = await request(db, await catalogInput(db));
    const tables = (
      await db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND substr(name,1,1)!='_' AND name!='d1_migrations' ORDER BY name",
        )
        .all<{ name: string }>()
    ).results;
    async function snapshot() {
      const data: Record<string, unknown> = {};
      for (const { name } of tables)
        data[name] = (
          await db.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all()
        ).results;
      return data;
    }
    const before = await snapshot();
    await migrate(db);
    await migrate(db);
    assert.deepEqual(await snapshot(), before);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM public_listing_disclosure"),
      0,
    );
    assert.equal((await browseStays(db)).items.length, 0);
    assert.deepEqual(
      await ownerReviewAction(db, owner, pendingDraft.id, pendingDraft.id, {
        action: "submit",
        propertyRevision: 1,
      }),
      { id: legacyPending, status: "pending" },
    );
    await assert.rejects(
      approve(db, legacyPending),
      /public_disclosure_required/,
    );
    await assert.rejects(publicStay(db, oldPublished.id), /not_found/);
    await decideReview(db, other, "return-old", legacyPending, {
      action: "return_changes",
      revision: 1,
      configRevision: 1,
      reason: "Confirm the public preview.",
    });
    await publish(db, pendingDraft.id);
    assert.equal((await publicStay(db, pendingDraft.id)).id, pendingDraft.id);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking WHERE id=?",
        oldBooking.id,
      ),
      1,
    );
  } finally {
    await p.dispose();
  }
});
async function catalogInput(db: D1Database) {
  const night = (await db
    .prepare("SELECT min(night) night FROM nightly_rate WHERE room_type_id='r'")
    .first<{ night: string }>())!.night;
  return {
    propertyId: "p",
    checkin: night,
    checkout: shiftNight(night, 1),
    termsVersion: "terms-v1",
    lines: [{ roomId: "r", quantity: 1, adults: 1, children: 0 }],
  };
}
