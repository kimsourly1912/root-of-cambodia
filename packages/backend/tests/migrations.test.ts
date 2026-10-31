import { env } from "cloudflare:workers";
import { test } from "vitest";
import assert from "node:assert/strict";
import { getMigrations } from "better-auth/db/migration";
import { database, migrate, catalog, request, owner, scalar } from "../src/testing/support";
import { testTransition as transition } from "../src/testing/booking-fixtures";
import { deliver } from "@root-of-cambodia/backend/shared";
import { makeAuth } from "@root-of-cambodia/backend/accounts";
test("fresh installation has all FKs/indexes and matches the pinned Better Auth configuration", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db);
    const applied = await db
      .prepare("SELECT name FROM d1_migrations ORDER BY name")
      .all<{ name: string }>();
    assert.deepEqual(
      applied.results.map((row) => row.name),
      env.TEST_MIGRATIONS.map((migration) => migration.name).sort(),
    );
    await migrate(db);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM d1_migrations"),
      env.TEST_MIGRATIONS.length,
    );
    const schema = await getMigrations(
      makeAuth(db, {
        secret: "local-test-secret-with-more-than-32-characters",
        baseURL: "http://127.0.0.1:8787",
        mailer: { send: async () => {} },
      }).options,
    );
    assert.equal(schema.toBeCreated.length, 0);
    assert.equal(schema.toBeAdded.length, 0);
    assert.equal(schema.toBeAddedIndexes.length, 0);
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
    const indexes = await db
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all<{ name: string }>();
    for (const name of [
      "property_owner",
      "room_property",
      "booking_guest",
      "booking_property",
      "booking_expiry",
      "outbox_due",
      "outbox_expired_lease",
      "allocation_booking",
    ])
      assert.ok(indexes.results.some((i) => i.name === name));
    const { input } = await catalog(db);
    const r = await request(db, input);
    await transition(db, owner, "accept", r.id, "accept");
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});
test("populated identity/catalog upgrade and populated booking/outbox upgrade preserve history and pending work", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, ["0001_identity_catalog.sql"]);
    const { input } = await catalog(db);
    await db
      .prepare(
        "INSERT INTO session(id,expiresAt,token,createdAt,updatedAt,userId) VALUES('s',9999999999999,'private-fixture-token',1,1,'guest')",
      )
      .run();
    await migrate(db, ["0002_booking_operations.sql"]);
    const r = await request(db, input);
    await transition(db, owner, "accept", r.id, "accept");
    await db
      .prepare(
        "INSERT INTO delivery_attempt(outbox_id,attempt,token,outcome) SELECT id,1,'old-attempt','started' FROM notification_outbox LIMIT 1",
      )
      .run();
    const counts = await db
      .prepare(
        "SELECT (SELECT count(*) FROM booking) b,(SELECT count(*) FROM booking_event) e,(SELECT sum(reserved) FROM inventory_night) r,(SELECT count(*) FROM notification_outbox) o",
      )
      .first();
    await migrate(db, ["0003_delivery_recovery.sql"]);
    assert.deepEqual(
      await db
        .prepare(
          "SELECT (SELECT count(*) FROM booking) b,(SELECT count(*) FROM booking_event) e,(SELECT sum(reserved) FROM inventory_night) r,(SELECT count(*) FROM notification_outbox) o",
        )
        .first(),
      counts,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM session WHERE id='s'"),
      1,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM delivery_attempt WHERE error_code IS NULL",
      ),
      1,
    );
    const row = await db
      .prepare(
        "SELECT id FROM notification_outbox WHERE id NOT IN(SELECT outbox_id FROM delivery_attempt) LIMIT 1",
      )
      .first<{ id: string }>();
    assert.ok(row);
    assert.equal(
      (await deliver(db, row.id, { send: async () => ({ id: "upgrade-ok" }) }))
        .delivered,
      true,
    );
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});

const legacyMigrations = [
  "0001_identity_catalog.sql",
  "0002_booking_operations.sql",
  "0003_delivery_recovery.sql",
];
const safeguards = ["0004_booking_safeguards.sql"];

async function snapshot(db: D1Database) {
  const tables = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '\\_%' ESCAPE '\\' AND name NOT LIKE 'sqlite_%' AND name!='d1_migrations' ORDER BY name",
    )
    .all<{ name: string }>();
  const data: Record<string, unknown> = {};
  for (const { name } of tables.results) {
    // Names come only from sqlite_master, never request input.
    data[name] = (
      await db
        .prepare(
          'SELECT * FROM "' + name.replaceAll('"', '""') + '" ORDER BY rowid',
        )
        .all()
    ).results;
  }
  return data;
}

test("safeguards upgrade retains every populated row, old schema object and original retry receipt", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, legacyMigrations);
    const { input } = await catalog(db, 4);
    const cancelled = await request(db, input, "cancelled-request");
    const accepted = await transition(
      db,
      owner,
      "accept-then-cancel",
      cancelled.id,
      "accept",
    );
    await transition(
      db,
      owner,
      "cancel",
      cancelled.id,
      "cancel_owner",
      "Fixture reason",
    );
    const confirmed = await request(db, input, "confirmed-request");
    await transition(db, owner, "accept", confirmed.id, "accept");
    await request(db, input, "pending-request");
    const checkedIn = await request(db, input, "checked-in-request");
    await transition(db, owner, "accept-import", checkedIn.id, "accept");
    // Historical trusted fixture uses its old command label. Migration preserves it.
    await db.batch([
      db.prepare(
        "INSERT INTO operation(id,principal,actor_id,key,fingerprint,kind,actor_role) VALUES('legacy-arrival','user:owner','owner','legacy-arrival','fixture','checked_in_import','owner')",
      ),
      db
        .prepare(
          "UPDATE booking SET status='checked_in',last_operation_id='legacy-arrival' WHERE id=?",
        )
        .bind(checkedIn.id),
    ]);
    await db
      .prepare(
        "INSERT INTO delivery_attempt(outbox_id,attempt,token,outcome) SELECT id,1,'upgrade-attempt','started' FROM notification_outbox LIMIT 1",
      )
      .run();
    // Current property values may differ from the immutable submission snapshot.
    await db
      .prepare(
        "UPDATE property SET checkin_time='16:00',policy_text='New rules' WHERE id='p'",
      )
      .run();
    const before = await snapshot(db);
    const objects = (
      await db
        .prepare(
          "SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all()
    ).results;
    await migrate(db, safeguards);
    assert.deepEqual(await snapshot(db), before);
    for (const object of objects) {
      assert.deepEqual(
        await db
          .prepare("SELECT type,name,sql FROM sqlite_master WHERE name=?")
          .bind(object.name)
          .first(),
        object,
      );
    }
    await migrate(db); // Full discovery/reapplication is safe on an upgraded database.
    const afterDraftMigration = await snapshot(db);
    assert.deepEqual(afterDraftMigration.property_draft_event, []);
    delete afterDraftMigration.property_draft_event;
    assert.deepEqual(afterDraftMigration.room_type_event, []);
    delete afterDraftMigration.room_type_event;
    assert.deepEqual(afterDraftMigration.room_calendar_event, []);
    delete afterDraftMigration.room_calendar_event;
    assert.deepEqual(afterDraftMigration.property_information, []);
    delete afterDraftMigration.property_information;
    assert.deepEqual(afterDraftMigration.property_information_event, []);
    delete afterDraftMigration.property_information_event;
    assert.deepEqual(afterDraftMigration.property_media, []);
    assert.deepEqual(afterDraftMigration.property_media_gallery, []);
    assert.deepEqual(afterDraftMigration.property_media_event, []);
    delete afterDraftMigration.property_media;
    delete afterDraftMigration.property_media_gallery;
    delete afterDraftMigration.property_media_event;
    assert.deepEqual(afterDraftMigration.property_logistics, []);
    assert.deepEqual(afterDraftMigration.property_logistics_event, []);
    delete afterDraftMigration.property_logistics;
    delete afterDraftMigration.property_logistics_event;
    for (const table of ["pilot_publication_config","property_review_command","property_review_request","property_review_event","public_listing_disclosure","booking_terms_document","guest_booking_attempt","booking_acceptance","owner_booking_attempt","booking_payment_event","booking_payment_state","booking_payment_attempt","external_booking_attempt","listing_control_event"]) {
      assert.deepEqual(afterDraftMigration[table], []);
      delete afterDraftMigration[table];
    }
    assert.deepEqual(afterDraftMigration, before);
    assert.deepEqual(
      await transition(db, owner, "accept-then-cancel", cancelled.id, "accept"),
      accepted,
    );
    assert.equal(
      await scalar(
        db,
        "SELECT count(*) n FROM booking WHERE id=? AND status='cancelled'",
        cancelled.id,
      ),
      1,
    );
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM d1_migrations"),
      env.TEST_MIGRATIONS.length,
    );
    assert.equal(
      (
        await transition(
          db,
          owner,
          "complete-upgraded-stay",
          checkedIn.id,
          "complete",
        )
      ).status,
      "completed",
    );
  } finally {
    await p.dispose();
  }
});

test.each(["null identity", "incoherent schedule"])(
  "safeguards upgrade rejects legacy %s atomically without editing history",
  async (defect) => {
    const p = await database({ migrate: false });
    try {
      const db = p.db;
      await migrate(db, legacyMigrations);
      const { input } = await catalog(db);
      const original = await request(db, input);
      if (defect === "null identity") {
        await db
          .prepare(
            "INSERT INTO place(id,name_km,name_en,province) VALUES(NULL,'Legacy','Legacy','Kampot')",
          )
          .run();
      } else {
        const columns = (
          await db.prepare("PRAGMA table_info(booking)").all<{ name: string }>()
        ).results.map((c) => c.name);
        await db
          .prepare(
            "INSERT INTO booking(" +
              columns.join(",") +
              ") SELECT " +
              columns
                .map((c) =>
                  c === "id"
                    ? "id||'-invalid'"
                    : c === "status"
                      ? "'building'"
                      : c === "checkin_time"
                        ? "'25:00'"
                        : c,
                )
                .join(",") +
              " FROM booking WHERE id=?",
          )
          .bind(original.id)
          .run();
      }
      const before = await snapshot(db);
      const schemaBefore = (
        await db
          .prepare("SELECT type,name,sql FROM sqlite_master ORDER BY name")
          .all()
      ).results;
      await assert.rejects(
        migrate(db, safeguards),
        /migration_0004_existing_data_valid/,
      );
      assert.deepEqual(await snapshot(db), before);
      assert.deepEqual(
        (
          await db
            .prepare("SELECT type,name,sql FROM sqlite_master ORDER BY name")
            .all()
        ).results,
        schemaBefore,
      );
      assert.equal(
        await scalar(
          db,
          "SELECT count(*) n FROM d1_migrations WHERE name='0004_booking_safeguards.sql'",
        ),
        0,
      );
    } finally {
      await p.dispose();
    }
  },
);

test("room history upgrade preserves populated owner drafts, bookings and original receipts", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, [
      ...legacyMigrations,
      ...safeguards,
      "0005_property_drafts.sql",
    ]);
    const { input } = await catalog(db);
    const booking = await request(db, input, "room-upgrade-booking");
    const { createPropertyDraft } =
      await import("@root-of-cambodia/backend/properties");
    const fields = {
      ownerName: "Owner",
      nameKm: "????",
      nameEn: "Draft",
      province: "Kampot",
      checkinTime: "14:00",
      checkoutTime: "11:00",
      policyText: "Quiet hours.",
    };
    const draft = await createPropertyDraft(db, owner, "upgrade-draft", fields);
    const before = await snapshot(db);
    await migrate(db, ["0006_room_type_history.sql"]);
    const after = await snapshot(db);
    assert.deepEqual(after.room_type_event, []);
    delete after.room_type_event;
    assert.deepEqual(after, before);
    assert.deepEqual(
      await createPropertyDraft(db, owner, "upgrade-draft", fields),
      draft,
    );
    assert.deepEqual(await request(db, input, "room-upgrade-booking"), booking);
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});

test("calendar upgrade retains populated stock, rates, room/property history and original booking receipts", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, [
      ...legacyMigrations,
      ...safeguards,
      "0005_property_drafts.sql",
      "0006_room_type_history.sql",
    ]);
    const { input } = await catalog(db);
    const booking = await request(db, input, "calendar-upgrade-booking");
    const { createPropertyDraft } =
      await import("@root-of-cambodia/backend/properties");
    const { createRoomType } =
      await import("@root-of-cambodia/backend/rooms");
    const propertyFields = {
      ownerName: "Owner",
      nameKm: "????",
      nameEn: "Draft",
      province: "Kampot",
      checkinTime: "14:00",
      checkoutTime: "11:00",
      policyText: "Quiet hours.",
    };
    const property = await createPropertyDraft(
      db,
      owner,
      "calendar-upgrade-property",
      propertyFields,
    );
    const roomFields = {
      name: "Twin",
      adultCapacity: 2,
      childCapacity: 1,
      totalCapacity: 3,
    };
    const room = await createRoomType(
      db,
      owner,
      "calendar-upgrade-room",
      property.id,
      roomFields,
    );
    const before = await snapshot(db);
    await migrate(db, ["0007_room_calendar_history.sql"]);
    const after = await snapshot(db);
    assert.deepEqual(after.room_calendar_event, []);
    delete after.room_calendar_event;
    assert.deepEqual(after, before);
    assert.deepEqual(
      await createPropertyDraft(
        db,
        owner,
        "calendar-upgrade-property",
        propertyFields,
      ),
      property,
    );
    assert.deepEqual(
      await createRoomType(
        db,
        owner,
        "calendar-upgrade-room",
        property.id,
        roomFields,
      ),
      room,
    );
    assert.deepEqual(
      await request(db, input, "calendar-upgrade-booking"),
      booking,
    );
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});

test("information upgrade preserves populated calendars, prior history and original retry receipts", async () => {
  const p = await database({ migrate: false });
  try {
    const db = p.db;
    await migrate(db, [
      ...legacyMigrations,
      ...safeguards,
      "0005_property_drafts.sql",
      "0006_room_type_history.sql",
      "0007_room_calendar_history.sql",
    ]);
    const { input } = await catalog(db);
    const booking = await request(db, input, "information-upgrade-booking");
    const { createPropertyDraft } =
      await import("@root-of-cambodia/backend/properties");
    const { createRoomType } =
      await import("@root-of-cambodia/backend/rooms");
    const { saveRoomCalendar } =
      await import("@root-of-cambodia/backend/calendar");
    const propertyFields = {
      ownerName: "Owner",
      nameKm: "????",
      nameEn: "Draft",
      province: "Kampot",
      checkinTime: "14:00",
      checkoutTime: "11:00",
      policyText: "Quiet hours.",
    };
    const property = await createPropertyDraft(
      db,
      owner,
      "information-upgrade-property",
      propertyFields,
    );
    const roomFields = {
      name: "Twin",
      adultCapacity: 2,
      childCapacity: 1,
      totalCapacity: 3,
    };
    const room = await createRoomType(
      db,
      owner,
      "information-upgrade-room",
      property.id,
      roomFields,
    );
    const calendarFields = {
      roomRevision: 1,
      nights: [
        {
          night: "2027-01-03",
          capacity: 2,
          blocked: 0,
          unitCents: 1999,
          inventoryRevision: null,
          rateRevision: null,
        },
      ],
    };
    const calendar = await saveRoomCalendar(
      db,
      owner,
      "information-upgrade-calendar",
      property.id,
      room.id,
      calendarFields,
    );
    const before = await snapshot(db);
    await migrate(db, ["0008_property_information.sql"]);
    const after = await snapshot(db);
    assert.deepEqual(after.property_information, []);
    assert.deepEqual(after.property_information_event, []);
    delete after.property_information;
    delete after.property_information_event;
    assert.deepEqual(after, before);
    assert.deepEqual(
      await createPropertyDraft(
        db,
        owner,
        "information-upgrade-property",
        propertyFields,
      ),
      property,
    );
    assert.deepEqual(
      await createRoomType(
        db,
        owner,
        "information-upgrade-room",
        property.id,
        roomFields,
      ),
      room,
    );
    assert.deepEqual(
      await saveRoomCalendar(
        db,
        owner,
        "information-upgrade-calendar",
        property.id,
        room.id,
        calendarFields,
      ),
      calendar,
    );
    assert.deepEqual(
      await request(db, input, "information-upgrade-booking"),
      booking,
    );
    assert.deepEqual(
      (await db.prepare("PRAGMA foreign_key_check").all()).results,
      [],
    );
  } finally {
    await p.dispose();
  }
});
