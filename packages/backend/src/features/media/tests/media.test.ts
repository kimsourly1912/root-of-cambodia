import { test } from "vitest";
import assert from "node:assert/strict";
import { env } from "cloudflare:workers";
import {
  database,
  catalog,
  request,
  owner,
  other,
  unverified,
  scalar,
  migrate,
} from "../../../testing/support";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import {
  ownerMediaGallery,
  ownerMediaAsset,
  mediaKeys,
} from "@root-of-cambodia/backend/media";
import {
  preparePhoto,
  uploadPhoto,
  editPhotos,
  readPhotoPreview,
  cleanupRemovedPhotos,
  photoDigest,
  safeJpeg,
  type PhotoProcessor,
} from "@root-of-cambodia/backend/media";
import {
  reorderMedia,
  completeMedia,
} from "../media-persistence";
import { photoProcessor } from "../../../../../../apps/web/src/media-runtime";
import fixtures from "../../../testing/photo-fixtures.json";

const bytes = (kind: keyof typeof fixtures) =>
  Uint8Array.from(atob(fixtures[kind]), (c) => c.charCodeAt(0));
const jpeg = bytes("jpeg");
// Failure/race injection at the actual external boundary. Separate tests below
// exercise the real offline Images adapter and real R2, not just this test double.
const processor: PhotoProcessor = {
  inspect: async () => ({ format: "jpeg", width: 3, height: 2 }),
  preview: async () => jpeg,
};
const fields = {
  ownerName: "Owner",
  nameKm: "Draft",
  nameEn: "House",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours.",
};
async function setup(db: D1Database) {
  await catalog(db);
  return (await createPropertyDraft(db, owner, "draft", fields)).id;
}
async function prepare(db: D1Database, id: string, key = "photo", data = jpeg) {
  const gallery = await ownerMediaGallery(db, owner, id);
  return preparePhoto(db, owner, key, id, {
    revision: gallery.revision,
    contentType: "image/jpeg",
    byteSize: data.length,
    sha256: await photoDigest(data),
  });
}
async function edit(
  db: D1Database,
  id: string,
  key: string,
  patch: Record<string, unknown>,
) {
  return editPhotos(db, owner, key, id, {
    revision: (await ownerMediaGallery(db, owner, id)).revision,
    ...patch,
  });
}
const storeProxy = (handle: (key: string, value: unknown) => unknown) =>
  new Proxy(env.MEDIA, {
    get(target, key) {
      const value = Reflect.get(target, key);
      return handle(
        String(key),
        typeof value === "function" ? value.bind(target) : value,
      );
    },
  });

test("private photo registration, content validation, immutable R2 objects, readiness and stable retries", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    assert.deepEqual(await ownerMediaGallery(db, owner, id), {
      revision: null,
      photos: [],
    });
    const receipt = await prepare(db, id);
    assert.equal(receipt.status, "pending");
    const asset = await ownerMediaAsset(db, owner, id, receipt.id),
      keys = mediaKeys(asset);
    assert.equal(await env.MEDIA.get(keys.original), null);
    await assert.rejects(
      readPhotoPreview(db, env.MEDIA, owner, id, receipt.id),
      /not_found/,
    );
    const ready = await uploadPhoto(
      db,
      env.MEDIA,
      processor,
      owner,
      id,
      receipt.id,
      jpeg,
    );
    assert.deepEqual(ready, { id: receipt.id, status: "ready" });
    const gallery = await ownerMediaGallery(db, owner, id);
    assert.equal(gallery.revision, 2);
    assert.equal(gallery.photos[0].state, "ready");
    assert.deepEqual(
      new Uint8Array(await (await env.MEDIA.get(keys.original))!.arrayBuffer()),
      jpeg,
    );
    const preview = new Uint8Array(
      await new Response(
        await readPhotoPreview(db, env.MEDIA, owner, id, receipt.id),
      ).arrayBuffer(),
    );
    assert.deepEqual(preview, safeJpeg(jpeg));
    const noWrites = storeProxy((key, value) =>
      key === "put"
        ? async () => {
            throw new Error("must not write again");
          }
        : value,
    );
    assert.deepEqual(
      await uploadPhoto(db, noWrites, processor, owner, id, receipt.id, jpeg),
      ready,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_media_event"),
      2,
    );
    // Registration receipt is replayed from its original payload, not the newer gallery revision.
    assert.deepEqual(
      await preparePhoto(db, owner, "photo", id, {
        revision: null,
        contentType: "image/jpeg",
        byteSize: jpeg.length,
        sha256: await photoDigest(jpeg),
      }),
      receipt,
    );
    assert.equal(
      await scalar(db, "SELECT revision n FROM property WHERE id=?", id),
      1,
    );
  } finally {
    await p.dispose();
  }
});

test.each(["jpeg", "png", "webp"] as const)(
  "the real offline Images adapter decodes %s and produces a bounded JPEG preview",
  async (kind) => {
    const p = await database();
    try {
      const db = p.db,
        id = await setup(db),
        data = bytes(kind),
        gallery = await ownerMediaGallery(db, owner, id);
      const photo = await preparePhoto(db, owner, "actual", id, {
        revision: gallery.revision,
        contentType: "image/" + kind,
        byteSize: data.length,
        sha256: await photoDigest(data),
      });
      await uploadPhoto(
        db,
        env.MEDIA,
        photoProcessor(env.IMAGES),
        owner,
        id,
        photo.id,
        data,
      );
      const body = new Uint8Array(
        await new Response(
          await readPhotoPreview(db, env.MEDIA, owner, id, photo.id),
        ).arrayBuffer(),
      );
      assert.equal(body[0], 255);
      assert.equal(body[1], 216);
      const info = await env.IMAGES.info(new Blob([body]).stream());
      assert.ok(
        "width" in info &&
          info.width <= 1600 &&
          "height" in info &&
          info.height <= 1600,
      );
    } finally {
      await p.dispose();
    }
  },
);

test("photo validation rejects unsupported declarations, wrong bytes, corrupt decoding, animation and excessive dimensions before storage", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db),
      base = {
        revision: null,
        contentType: "image/jpeg",
        byteSize: jpeg.length,
        sha256: await photoDigest(jpeg),
      };
    for (const patch of [
      { contentType: "image/svg+xml" },
      { contentType: "image/gif" },
      { byteSize: 0 },
      { byteSize: 8388609 },
      { byteSize: 1.5 },
      { sha256: "ABC" },
      { revision: 0 },
      { revision: undefined },
      { ownerId: "other" },
      { objectKey: "public" },
      { publication: "published" },
    ])
      await assert.rejects(
        preparePhoto(db, owner, crypto.randomUUID(), id, { ...base, ...patch }),
        /invalid_photo/,
      );
    const photo = await prepare(db, id);
    await assert.rejects(
      uploadPhoto(
        db,
        env.MEDIA,
        processor,
        owner,
        id,
        photo.id,
        new Uint8Array([1, 2, 3]),
      ),
      /invalid_photo/,
    );
    const excessive = {
      ...processor,
      inspect: async () => ({ format: "jpeg", width: 8001, height: 2 }),
    };
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, excessive, owner, id, photo.id, jpeg),
      /invalid_photo/,
    );
    const pixels = {
      ...processor,
      inspect: async () => ({ format: "jpeg", width: 6000, height: 6000 }),
    };
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, pixels, owner, id, photo.id, jpeg),
      /invalid_photo/,
    );
    const corrupt = {
      ...processor,
      inspect: async () => {
        throw new Error("private provider detail");
      },
    };
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, corrupt, owner, id, photo.id, jpeg),
      /invalid_photo/,
    );
    const badPreview = {
      ...processor,
      preview: async () => new TextEncoder().encode("<svg>unsafe</svg>"),
    };
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, badPreview, owner, id, photo.id, jpeg),
      /photo_processing_unavailable/,
    );
    const forged = new Uint8Array([60, 115, 118, 103, 62]);
    const forgedPhoto = await prepare(db, id, "forged", forged);
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, processor, owner, id, forgedPhoto.id, forged),
      /invalid_photo/,
    );
    assert.equal(
      await env.MEDIA.get(
        mediaKeys({ id: photo.id, property_id: id }).original,
      ),
      null,
    );
    assert.equal(
      (await ownerMediaGallery(db, owner, id)).photos.every(
        (x) => x.state === "pending",
      ),
      true,
    );
    const animated = bytes("png");
    // Add an acTL chunk: reject by actual content even if the decoder double accepts it.
    const chunk = new Uint8Array([0, 0, 0, 0, 97, 99, 84, 76, 0, 0, 0, 0]);
    const apng = new Uint8Array(animated.length + chunk.length);
    apng.set(animated.subarray(0, 33));
    apng.set(chunk, 33);
    apng.set(animated.subarray(33), 45);
    const a = await preparePhoto(db, owner, "animated", id, {
      revision: (await ownerMediaGallery(db, owner, id)).revision,
      contentType: "image/png",
      byteSize: apng.length,
      sha256: await photoDigest(apng),
    });
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, processor, owner, id, a.id, apng),
      /invalid_photo/,
    );
  } finally {
    await p.dispose();
  }
});

test("reads, uploads, edits and receipt replays require current verified ownership of the exact private draft", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db),
      photo = await prepare(db, id);
    await uploadPhoto(db, env.MEDIA, processor, owner, id, photo.id, jpeg);
    for (const actor of [other, unverified]) {
      const code = actor === other ? /not_found/ : /verified_session_required/;
      await assert.rejects(ownerMediaGallery(db, actor, id), code);
      await assert.rejects(ownerMediaAsset(db, actor, id, photo.id), code);
      await assert.rejects(
        readPhotoPreview(db, env.MEDIA, actor, id, photo.id),
        code,
      );
      await assert.rejects(
        uploadPhoto(db, env.MEDIA, processor, actor, id, photo.id, jpeg),
        code,
      );
      await assert.rejects(
        editPhotos(db, actor, "bad", id, {
          action: "remove",
          revision: 2,
          id: photo.id,
        }),
        code,
      );
    }
    await assert.rejects(
      ownerMediaAsset(db, owner, "p", photo.id),
      /not_found/,
    );
    await db
      .prepare("UPDATE place SET publication='review' WHERE id=?")
      .bind(id)
      .run();
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, processor, owner, id, photo.id, jpeg),
      /not_found/,
    );
    await assert.rejects(
      preparePhoto(db, owner, "photo", id, {
        revision: null,
        contentType: "image/jpeg",
        byteSize: jpeg.length,
        sha256: await photoDigest(jpeg),
      }),
      /not_found/,
    );
  } finally {
    await p.dispose();
  }
});

test("same-key races deduplicate registration and completion; competing/stale first edits cannot overwrite the gallery", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db),
      base = {
        revision: null,
        contentType: "image/jpeg",
        byteSize: jpeg.length,
        sha256: await photoDigest(jpeg),
      };
    const same = await Promise.all([
      preparePhoto(db, owner, "race", id, base),
      preparePhoto(db, owner, "race", id, base),
    ]);
    assert.deepEqual(same[0], same[1]);
    const uploaded = await Promise.all([
      uploadPhoto(db, env.MEDIA, processor, owner, id, same[0].id, jpeg),
      uploadPhoto(db, env.MEDIA, processor, owner, id, same[0].id, jpeg),
    ]);
    assert.deepEqual(uploaded[0], uploaded[1]);
    await assert.rejects(
      preparePhoto(db, owner, "stale", id, base),
      /booking_conflict/,
    );
    await assert.rejects(
      preparePhoto(db, owner, "race", id, { ...base, sha256: "f".repeat(64) }),
      /idempotency_conflict/,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM property_media"), 1);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_media_event"),
      2,
    );
    const version = (await ownerMediaGallery(db, owner, id)).revision;
    const edits = await Promise.allSettled(
      ["a", "b"].map((key) =>
        editPhotos(db, owner, key, id, {
          action: "reorder",
          revision: version,
          ids: [same[0].id],
        }),
      ),
    );
    assert.equal(edits.filter((r) => r.status === "fulfilled").length, 1);
  } finally {
    await p.dispose();
  }
});

test("ordering is an exact owned set; removal leaves an immutable tombstone and safe receipt, and gallery limits roll back", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db),
      a = await prepare(db, id, "a"),
      b = await prepare(db, id, "b");
    for (const ids of [
      [a.id],
      [a.id, a.id],
      [a.id, "00000000-0000-0000-0000-000000000000"],
    ])
      await assert.rejects(
        edit(db, id, crypto.randomUUID(), { action: "reorder", ids }),
        /invalid_photo|booking_conflict/,
      );
    await edit(db, id, "order", { action: "reorder", ids: [b.id, a.id] });
    assert.deepEqual(
      (await ownerMediaGallery(db, owner, id)).photos.map((x) => x.id),
      [b.id, a.id],
    );
    const revision = (await ownerMediaGallery(db, owner, id)).revision;
    const payload = { action: "remove", revision, id: a.id };
    const removed = await editPhotos(db, owner, "remove", id, payload);
    assert.deepEqual(
      await editPhotos(db, owner, "remove", id, payload),
      removed,
    );
    assert.equal((await ownerMediaAsset(db, owner, id, a.id)).state, "removed");
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, processor, owner, id, a.id, jpeg),
      /not_found/,
    );
    await assert.rejects(
      db
        .prepare(
          "UPDATE property_media SET state='pending',cleanup_at=NULL WHERE id=?",
        )
        .bind(a.id)
        .run(),
      /invalid_media_transition/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM property_media WHERE id=?").bind(a.id).run(),
      /immutable_media_identity/,
    );
    await assert.rejects(
      db.prepare("DELETE FROM property_media_event").run(),
      /immutable_media_history/,
    );
    for (let i = 1; i < 20; i++) await prepare(db, id, "limit-" + i);
    await assert.rejects(prepare(db, id, "over-limit"), /booking_conflict/);
    assert.equal((await ownerMediaGallery(db, owner, id)).photos.length, 20);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE key='over-limit'",
      ),
      0,
    );
  } finally {
    await p.dispose();
  }
});

test("R2 failure and lost D1 responses keep incomplete bytes private and recover one photo using its original identity", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db);
    let lost = false;
    const flaky = new Proxy(db, {
      get(target, key) {
        if (key === "batch")
          return async (statements: D1PreparedStatement[]) => {
            const result = await target.batch(statements);
            if (!lost) {
              lost = true;
              throw new Error("Lost response");
            }
            return result;
          };
        const v = Reflect.get(target, key);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    const photo = await prepare(flaky, id),
      keys = mediaKeys({ id: photo.id, property_id: id });
    let calls = 0;
    const interrupted = storeProxy((key, value) =>
      key === "put"
        ? async (...args: Parameters<R2Bucket["put"]>) => {
            calls++;
            if (calls === 2) throw new Error("Storage unavailable");
            return (value as R2Bucket["put"])(...args);
          }
        : value,
    );
    await assert.rejects(
      uploadPhoto(db, interrupted, processor, owner, id, photo.id, jpeg),
      /Storage unavailable/,
    );
    assert.ok(await env.MEDIA.get(keys.original));
    assert.equal(
      (await ownerMediaAsset(db, owner, id, photo.id)).state,
      "pending",
    );
    await assert.rejects(
      readPhotoPreview(db, env.MEDIA, owner, id, photo.id),
      /not_found/,
    );
    lost = false;
    await uploadPhoto(flaky, env.MEDIA, processor, owner, id, photo.id, jpeg);
    assert.equal(
      (await ownerMediaAsset(db, owner, id, photo.id)).state,
      "ready",
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_media_event"),
      2,
    );
  } finally {
    await p.dispose();
  }
});

test("removal during processing cannot resurrect a photo; cleanup retries failures and catches late in-flight writes", async () => {
  const p = await database();
  try {
    const db = p.db,
      id = await setup(db),
      photo = await prepare(db, id),
      keys = mediaKeys({ id: photo.id, property_id: id });
    const concurrent = {
      ...processor,
      preview: async () => {
        await edit(db, id, "remove-during-upload", {
          action: "remove",
          id: photo.id,
        });
        return jpeg;
      },
    };
    await assert.rejects(
      uploadPhoto(db, env.MEDIA, concurrent, owner, id, photo.id, jpeg),
      /booking_conflict/,
    );
    assert.ok(await env.MEDIA.get(keys.original));
    await assert.rejects(
      readPhotoPreview(db, env.MEDIA, owner, id, photo.id),
      /not_found/,
    );
    const fail = storeProxy((key, value) =>
      key === "delete"
        ? async () => {
            throw new Error("delete failed");
          }
        : value,
    );
    assert.deepEqual(await cleanupRemovedPhotos(db, fail), {
      attempted: 1,
      failed: 1,
    });
    await db
      .prepare("UPDATE property_media SET cleanup_at=unixepoch() WHERE id=?")
      .bind(photo.id)
      .run();
    assert.deepEqual(await cleanupRemovedPhotos(db, env.MEDIA), {
      attempted: 1,
      failed: 0,
    });
    assert.equal(await env.MEDIA.get(keys.original), null);
    assert.equal(await env.MEDIA.get(keys.preview), null);
    await env.MEDIA.put(keys.preview, jpeg); // Late external write after an earlier successful purge.
    await db
      .prepare("UPDATE property_media SET cleanup_at=unixepoch() WHERE id=?")
      .bind(photo.id)
      .run();
    await cleanupRemovedPhotos(db, env.MEDIA);
    assert.equal(await env.MEDIA.get(keys.preview), null);
    assert.deepEqual((await ownerMediaGallery(db, owner, id)).photos, []);
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM operation WHERE kind='media_ready'",
      ),
      0,
    );
  } finally {
    await p.dispose();
  }
});

test.each(["owner", "verification", "publication", "audit"])(
  "write-time %s changes reject readiness and preserve the pending journal without a success receipt",
  async (change) => {
    const p = await database();
    try {
      const db = p.db,
        id = await setup(db),
        photo = await prepare(db, id);
      const concurrent = {
        ...processor,
        preview: async () => {
          if (change === "owner")
            await db
              .prepare("UPDATE property SET owner_id='other' WHERE id=?")
              .bind(id)
              .run();
          if (change === "verification")
            await db
              .prepare("UPDATE user SET emailVerified=0 WHERE id='owner'")
              .run();
          if (change === "publication")
            await db
              .prepare("UPDATE place SET publication='review' WHERE id=?")
              .bind(id)
              .run();
          if (change === "audit")
            await db
              .prepare(
                "CREATE TRIGGER fail_media BEFORE INSERT ON property_media_event BEGIN SELECT RAISE(ABORT,'invalid_test_media'); END",
              )
              .run();
          return jpeg;
        },
      };
      await assert.rejects(
        uploadPhoto(db, env.MEDIA, concurrent, owner, id, photo.id, jpeg),
        /booking_conflict/,
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM property_media WHERE state='pending'",
        ),
        1,
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM operation WHERE kind='media_ready'",
        ),
        0,
      );
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM property_media_event"),
        1,
      );
      if (change === "audit") {
        await db.prepare("DROP TRIGGER fail_media").run();
        await assert.rejects(
          reorderMedia(db, owner, "forged", id, 1, []),
          /booking_conflict/,
        );
        await assert.rejects(
          completeMedia(db, other, "forged-owner", id, photo.id, 3, 2),
          /booking_conflict/,
        );
      }
    } finally {
      await p.dispose();
    }
  },
);

test("JPEG preview stripping removes all metadata segments, including EXIF/GPS and comments", () => {
  const secret = new TextEncoder().encode("Exif\0\0GPS-private-location");
  const segment = new Uint8Array(secret.length + 4);
  segment.set([255, 225, (secret.length + 2) >> 8, (secret.length + 2) & 255]);
  segment.set(secret, 4);
  const input = new Uint8Array(jpeg.length + segment.length);
  input.set(jpeg.subarray(0, 2));
  input.set(segment, 2);
  input.set(jpeg.subarray(2), 2 + segment.length);
  const output = safeJpeg(input);
  assert.equal(
    new TextDecoder().decode(output).includes("private-location"),
    false,
  );
  assert.deepEqual(output, safeJpeg(jpeg));
  const afterScan = new Uint8Array(jpeg.length + segment.length);
  afterScan.set(jpeg.subarray(0, -2));
  afterScan.set(segment, jpeg.length - 2);
  afterScan.set(jpeg.subarray(-2), jpeg.length - 2 + segment.length);
  assert.deepEqual(safeJpeg(afterScan), safeJpeg(jpeg));
});

test("media migration preserves populated previous tables, schema objects and original booking/draft receipts", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(
      db,
      env.TEST_MIGRATIONS.filter((m) => !m.name.startsWith("0009_")).map(
        (m) => m.name,
      ),
    );
    const { input } = await catalog(db);
    const booking = await request(db, input, "before-media");
    const draft = await createPropertyDraft(db, owner, "draft", fields);
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      const tables = (
        await db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' AND name<>'d1_migrations' AND name NOT LIKE 'property_media%' ORDER BY name",
          )
          .all<{ name: string }>()
      ).results;
      for (const { name } of tables)
        result[name] = (
          await db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()
        ).results;
      return result;
    };
    const before = await snapshot();
    const objects = (
      await db
        .prepare(
          "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT GLOB '_cf_*' ORDER BY name",
        )
        .all()
    ).results;
    await migrate(db, ["0009_property_media.sql"]);
    assert.deepEqual(await snapshot(), before);
    for (const object of objects)
      assert.deepEqual(
        await db
          .prepare("SELECT type,name,sql FROM sqlite_master WHERE name=?")
          .bind(object.name)
          .first(),
        object,
      );
    assert.deepEqual(await request(db, input, "before-media"), booking);
    assert.deepEqual(
      await createPropertyDraft(db, owner, "draft", fields),
      draft,
    );
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
    assert.deepEqual(await ownerMediaGallery(db, owner, draft.id), {
      revision: null,
      photos: [],
    });
  } finally {
    await p.dispose();
  }
});
