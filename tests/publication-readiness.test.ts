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
} from "./support";
import { env } from "cloudflare:workers";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import {
  ownerReviewAction,
  decideReview,
} from "@root-of-cambodia/backend/publication";
import {
  ownerPublication,
  reviewDetails,
  readSnapshot,
} from "@root-of-cambodia/backend/publication";
import {
  readPublicationReadiness,
  publicationReadySQL,
  type ReadinessItem,
} from "@root-of-cambodia/backend/publication";
import { commitPublicationAction } from "../packages/backend/src/features/publication/publication-persistence";
import { preparePhoto } from "@root-of-cambodia/backend/media";
import { editPhotos } from "@root-of-cambodia/backend/media";
import { ownerMediaGallery } from "@root-of-cambodia/backend/media";
import { quote } from "@root-of-cambodia/backend/quotes";
import { submit as submitBooking } from "@root-of-cambodia/backend/bookings";
import { testTransition as transition } from "./booking-fixtures";
import { shiftNight } from "@root-of-cambodia/backend/calendar";
import { digest } from "@root-of-cambodia/backend/shared";
import { readyPublicationFixture, disclosureFor } from "./publication-fixtures";

const fields = {
  ownerName: "Owner",
  nameKm: "ផ្ទះ",
  nameEn: "",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours",
};
async function setup(
  db: D1Database,
  ready = true,
  calendarNight?: string | null,
) {
  await catalog(db);
  await db
    .prepare(
      "INSERT INTO pilot_publication_config VALUES(1,'other','approved-v1',1)",
    )
    .run();
  const { id } = await createPropertyDraft(db, owner, "draft", fields);
  return {
    id,
    supply: ready
      ? await readyPublicationFixture(db, owner, id, true, calendarNight)
      : null,
  };
}
const submit = async (db: D1Database, id: string, key = "submit") =>
  ownerReviewAction(db, owner, key, id, {
    action: "submit",
    propertyRevision: 1,
    publicDisclosure: await disclosureFor(db, id, owner.id),
  });
const approve = (db: D1Database, id: string, key = "approve") =>
  decideReview(db, other, key, id, {
    action: "approve",
    revision: 1,
    configRevision: 1,
  });
function beforeBatch(db: D1Database, action: () => Promise<unknown>) {
  let first = true;
  return new Proxy(db, {
    get(target, key) {
      if (key === "batch")
        return async (statements: D1PreparedStatement[]) => {
          if (first) {
            first = false;
            await action();
          }
          return target.batch(statements);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
// Native SQLite executes the unmodified readiness predicate except its clock
// source. This test-only table lets a clock advance between preparation/commit
// without waiting a day or adding any production clock/fixture endpoint.
async function clock(db: D1Database, at: number) {
  await db
    .prepare("CREATE TABLE test_readiness_clock(now INTEGER NOT NULL)")
    .run();
  await db.prepare("INSERT INTO test_readiness_clock VALUES(?)").bind(at).run();
  return new Proxy(db, {
    get(target, key) {
      if (key === "prepare")
        return (sql: string) =>
          target.prepare(
            sql.includes("n.night||'T'||p.checkin_time")
              ? sql.replaceAll(
                  "unixepoch()",
                  "(SELECT now FROM test_readiness_clock)",
                )
              : sql,
          );
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
const advance = (db: D1Database, at: number) =>
  db.prepare("UPDATE test_readiness_clock SET now=?").bind(at).run();

test("bare drafts remain editable but private readiness and direct submission identify missing requirements", async () => {
  const p = await database();
  try {
    const { id } = await setup(p.db, false);
    const state = await ownerPublication(p.db, owner, id);
    assert.equal(state.readiness.ready, false);
    assert.deepEqual(state.readiness.missing, [
      "description",
      "address",
      "contact",
      "photos",
      "rooms",
      "calendar",
    ]);
    await assert.rejects(submit(p.db, id), /publication_incomplete/);
    for (const actor of [guest, other])
      await assert.rejects(ownerPublication(p.db, actor, id), /not_found/);
    await assert.rejects(
      ownerPublication(p.db, unverified, id),
      /verified_session_required/,
    );
    assert.equal(
      await scalar(p.db, "SELECT count(*) n FROM property_review_command"),
      0,
    );
    assert.equal(
      (await ownerPublication(p.db, owner, id)).publication,
      "draft",
    );
  } finally {
    await p.dispose();
  }
});

test("every required content field blocks submission independently while optional fields stay optional", async () => {
  for (const missing of [
    "description",
    "address",
    "contact",
    "photos",
    "rooms",
    "calendar",
  ] as ReadinessItem[]) {
    const p = await database();
    try {
      const db = p.db,
        { id, supply } = await setup(
          db,
          true,
          missing === "calendar" ? null : undefined,
        );
      assert.equal(
        (await readPublicationReadiness(db, id, owner.id)).ready,
        missing !== "calendar",
      );
      if (missing === "description" || missing === "address")
        await db
          .prepare(
            `UPDATE property_information SET ${missing === "description" ? "description_text" : "address_text"}=?,revision=revision+1 WHERE property_id=?`,
          )
          .bind(" \t\n\u00a0\u2003\ufeff", id)
          .run();
      else if (missing === "contact")
        await db
          .prepare(
            "UPDATE property_logistics SET contact_email='',revision=revision+1 WHERE property_id=?",
          )
          .bind(id)
          .run();
      else if (missing === "photos")
        await editPhotos(db, owner, "remove", id, {
          action: "remove",
          id: supply!.photoId,
          revision: (await ownerMediaGallery(db, owner, id)).revision,
        });
      else if (missing === "rooms")
        await db
          .prepare("UPDATE room_type SET active=0 WHERE id=?")
          .bind(supply!.roomId)
          .run();
      const readiness = (await ownerPublication(db, owner, id)).readiness;
      assert.equal(readiness.checks[missing], false, missing);
      await assert.rejects(submit(db, id), /publication_incomplete/);
      assert.equal(
        await scalar(db, "SELECT count(*) n FROM property_review_request"),
        0,
      );
    } finally {
      await p.dispose();
    }
  }
});

test("calendar needs a matching future rate and positive stock on an active room of this property", async () => {
  for (const missing of ["past", "stock", "zero", "inactive", "mismatch"]) {
    const p = await database();
    try {
      const db = p.db,
        { id, supply } = await setup(
          db,
          true,
          missing === "past"
            ? "2020-01-01"
            : ["stock", "mismatch"].includes(missing)
              ? null
              : undefined,
        );
      if (missing === "stock" || missing === "mismatch") {
        await db
          .prepare(
            "INSERT INTO nightly_rate(room_type_id,night,unit_cents) VALUES (?,?,3500)",
          )
          .bind(supply!.roomId, shiftNight(supply!.night, 1))
          .run();
        if (missing === "mismatch")
          await db
            .prepare(
              "INSERT INTO inventory_night(room_type_id,night,capacity) VALUES (?,?,1)",
            )
            .bind(supply!.roomId, supply!.night)
            .run();
      } else if (missing === "zero")
        await db
          .prepare("UPDATE inventory_night SET capacity=0 WHERE room_type_id=?")
          .bind(supply!.roomId)
          .run();
      else if (missing === "inactive")
        await db
          .prepare("UPDATE room_type SET active=0 WHERE id=?")
          .bind(supply!.roomId)
          .run();
      assert.equal(
        (await readPublicationReadiness(db, id, owner.id)).checks.calendar,
        false,
        missing,
      );
      // The other property's configured rates must not fill this gap.
      await assert.rejects(submit(db, id), /publication_incomplete/);
    } finally {
      await p.dispose();
    }
  }
});

test("calendar eligibility includes exactly 24 Cambodia hours, handles leap day and midnight, and expires after the boundary", async () => {
  for (const time of ["14:00", "00:00"]) {
    const p = await database();
    try {
      const db = p.db,
        { id } = await setup(db, true, "2028-03-01");
      await db
        .prepare("UPDATE property SET checkin_time=? WHERE id=?")
        .bind(time, id)
        .run();
      const boundary = Date.parse(`2028-03-01T${time}:00+07:00`) / 1000 - 86400;
      const timed = await clock(db, boundary - 1);
      assert.equal(
        (await readPublicationReadiness(timed, id, owner.id)).ready,
        true,
      );
      await advance(db, boundary);
      assert.equal(
        (await readPublicationReadiness(timed, id, owner.id)).ready,
        true,
      );
      await advance(db, boundary + 1);
      assert.equal(
        (await readPublicationReadiness(timed, id, owner.id)).checks.calendar,
        false,
      );
    } finally {
      await p.dispose();
    }
  }
});

test("atomic submission and approval recheck deadline and stock setup without changing the immutable snapshot", async () => {
  for (const action of ["submit", "approve"]) {
    for (const change of ["clock", "capacity"]) {
      const p = await database();
      try {
        const db = p.db,
          { id, supply } = await setup(db);
        const boundary =
          Date.parse(supply!.night + "T14:00:00+07:00") / 1000 - 86400;
        const timed = await clock(db, boundary);
        const pending = action === "approve" ? await submit(timed, id) : null;
        const snapshot = (await readSnapshot(db, id, owner.id)).json;
        const raced = beforeBatch(timed, () =>
          change === "clock"
            ? advance(db, boundary + 1)
            : db
                .prepare(
                  "UPDATE inventory_night SET capacity=0 WHERE room_type_id=?",
                )
                .bind(supply!.roomId)
                .run(),
        );
        await assert.rejects(
          action === "submit"
            ? submit(raced, id, "loser")
            : approve(raced, pending!.id, "loser"),
          /review_conflict/,
        );
        assert.equal((await readSnapshot(db, id, owner.id)).json, snapshot);
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
          (await ownerPublication(db, owner, id)).publication,
          action === "submit" ? "draft" : "review",
        );
        if (pending) {
          assert.equal(
            (await reviewDetails(timed, other, pending.id)).readiness.checks
              .calendar,
            false,
          );
          await assert.rejects(
            approve(timed, pending.id),
            /publication_incomplete/,
          );
          await decideReview(timed, other, "corrections", pending.id, {
            action: "return_changes",
            revision: 1,
            configRevision: 1,
            reason: "Refresh future calendar setup.",
          });
          assert.equal(
            (await ownerPublication(db, owner, id)).publication,
            "draft",
          );
        }
      } finally {
        await p.dispose();
      }
    }
  }
});

test("earlier incomplete pending reviews retain snapshots and receipts but need correction before new approval", async () => {
  const p = await database({ migrate: false });
  try {
    await migrate(
      p.db,
      env.TEST_MIGRATIONS.filter((migration) => migration.name < "0012").map(
        (migration) => migration.name,
      ),
    );
    const db = p.db,
      { id } = await setup(db, false);
    const snapshot = (await readSnapshot(db, id, owner.id)).json;
    const command = crypto.randomUUID();
    const fingerprint = await digest({
      role: "owner",
      payload: { action: "submit", propertyId: id, propertyRevision: 1 },
    });
    // A coherent retained record produced by the previous release, whose
    // reminders did not yet require photos/rooms/information for submission.
    await db.batch([
      db
        .prepare(
          "INSERT INTO property_review_command(id,actor_id,actor_role,key,fingerprint,action) VALUES (?,'owner','owner','submit',?,'submit')",
        )
        .bind(command, fingerprint),
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
    await migrate(db);
    const legacySubmit = () =>
      ownerReviewAction(db, owner, "submit", id, {
        action: "submit",
        propertyRevision: 1,
      });
    assert.deepEqual(await legacySubmit(), { id: command, status: "pending" });
    const details = await reviewDetails(db, other, command);
    assert.equal(details.readiness.ready, false);
    assert.equal(
      JSON.stringify(details.request.snapshot),
      JSON.stringify(JSON.parse(snapshot)),
    );
    await assert.rejects(approve(db, command), /publication_incomplete/);
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_command"),
      1,
    );
    await decideReview(db, other, "return-legacy", command, {
      action: "return_changes",
      revision: 1,
      configRevision: 1,
      reason: "Complete the publication checklist.",
    });
    assert.deepEqual(await legacySubmit(), { id: command, status: "pending" });
    await assert.rejects(
      submit(db, id, "new-submission"),
      /publication_incomplete/,
    );
    assert.equal((await ownerPublication(db, owner, id)).publication, "draft");
  } finally {
    await p.dispose();
  }
});

test("calling atomic persistence directly cannot bypass readiness or leave a successful receipt", async () => {
  const p = await database();
  try {
    const db = p.db,
      { id } = await setup(db, false);
    const snapshot = await readSnapshot(db, id, owner.id);
    await assert.rejects(
      commitPublicationAction(
        db,
        owner,
        "bypass",
        { action: "submit", propertyId: id, propertyRevision: 1 },
        async () => ({
          action: "submit",
          propertyId: id,
          propertyRevision: 1,
          snapshotJson: snapshot.json,
        }),
        "owner",
      ),
      /review_conflict/,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_command"),
      0,
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_event"),
      0,
    );
    assert.equal((await ownerPublication(db, owner, id)).publication, "draft");
    // The guard query is the same set of predicates as the read model.
    assert.equal(
      await db.prepare(publicationReadySQL).bind(id, owner.id).first(),
      null,
    );
  } finally {
    await p.dispose();
  }
});

test("phone-only contact, one photo and a fully blocked calendar are complete without promising free stock", async () => {
  const p = await database();
  try {
    const db = p.db,
      { id, supply } = await setup(db);
    await db
      .prepare(
        "UPDATE property_logistics SET contact_phone='123',contact_email='',revision=revision+1 WHERE property_id=?",
      )
      .bind(id)
      .run();
    await db
      .prepare(
        "UPDATE inventory_night SET blocked=capacity WHERE room_type_id=?",
      )
      .bind(supply!.roomId)
      .run();
    assert.equal(
      (await readPublicationReadiness(db, id, owner.id)).ready,
      true,
    );
    const pending = await submit(db, id);
    await approve(db, pending.id);
    await assert.rejects(
      quote(db, guest, {
        propertyId: id,
        checkin: supply!.night,
        checkout: shiftNight(supply!.night, 1),
        termsVersion: "approved-v1",
        lines: [
          { roomId: supply!.roomId, quantity: 1, adults: 1, children: 0 },
        ],
      }),
      /inventory_unavailable/,
    );
  } finally {
    await p.dispose();
  }
});

test("fully reserved stock stays publication-complete and successful receipts replay after calendar eligibility expires", async () => {
  const p = await database();
  try {
    const db = p.db,
      { id, supply } = await setup(db);
    const boundary =
      Date.parse(supply!.night + "T14:00:00+07:00") / 1000 - 86400;
    const timed = await clock(db, boundary);
    const pending = await submit(timed, id);
    const approved = await approve(timed, pending.id);
    const input = {
      propertyId: id,
      checkin: supply!.night,
      checkout: shiftNight(supply!.night, 1),
      termsVersion: "approved-v1",
      lines: [{ roomId: supply!.roomId, quantity: 1, adults: 1, children: 0 }],
    };
    const q = await quote(db, guest, input);
    const booking = await submitBooking(db, guest, "booking", input, q.hash);
    await transition(db, owner, "accept", booking.id, "accept");
    assert.equal(
      (await readPublicationReadiness(timed, id, owner.id)).ready,
      true,
    );
    await assert.rejects(quote(db, guest, input), /inventory_unavailable/);
    await advance(db, boundary + 1);
    assert.equal(
      (await readPublicationReadiness(timed, id, owner.id)).checks.calendar,
      false,
    );
    assert.deepEqual(await submit(timed, id), pending);
    assert.deepEqual(await approve(timed, pending.id), approved);
    assert.equal(
      (await ownerPublication(db, owner, id)).publication,
      "published",
    );
    assert.equal(
      await scalar(db, "SELECT count(*) n FROM property_review_command"),
      2,
    );
  } finally {
    await p.dispose();
  }
});

test("a finished photo does not permit submission while another gallery upload remains unfinished", async () => {
  const p = await database();
  try {
    const db = p.db,
      { id } = await setup(db);
    await preparePhoto(db, owner, "unfinished", id, {
      contentType: "image/jpeg",
      byteSize: 4,
      sha256: "a".repeat(64),
      revision: (await ownerMediaGallery(db, owner, id)).revision,
    });
    const readiness = (await ownerPublication(db, owner, id)).readiness;
    assert.equal(readiness.checks.photos, true);
    assert.equal(readiness.checks.uploads, false);
    await assert.rejects(submit(db, id), /unfinished_photos/);
  } finally {
    await p.dispose();
  }
});
