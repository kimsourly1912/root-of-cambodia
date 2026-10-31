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
  configureReviewer,
  grantAdminStatements,
} from "../../../testing/support";
import {
  applyForOwnerAccess,
  decideOwnerApplication,
  ownerAccessStatus,
  ownerApplications,
} from "@root-of-cambodia/backend/owner-access";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";
import { capabilities } from "@root-of-cambodia/backend/shared";

const application = { businessName: "Kampot Riverside Homestay", phone: "+855 12 345 678", province: "Kampot" };
const draft = {
  ownerName: "Guest Owner",
  nameKm: "ផ្ទះស្នាក់",
  nameEn: "Riverside",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet nights.",
};
async function setup(db: D1Database) {
  await catalog(db);
  // "other" is the admin; "guest" is the applicant.
  await configureReviewer(db, "other", "approved-v1");
}

test("a verified account applies once, replays the same key and sees its pending application", async () => {
  const p = await database();
  try {
    const db = p.db;
    await setup(db);
    assert.equal((await ownerAccessStatus(db, guest)).status, "none");
    await assert.rejects(applyForOwnerAccess(db, unverified, "apply", application), /verified_session_required/);
    for (const bad of [
      { ...application, phone: "call me" },
      { ...application, businessName: " " },
      { ...application, extra: true },
      { businessName: application.businessName, phone: application.phone },
    ])
      await assert.rejects(applyForOwnerAccess(db, guest, "bad", bad), /invalid_owner_application/);
    const receipt = await applyForOwnerAccess(db, guest, "apply", application);
    assert.deepEqual(receipt, { id: "guest", status: "pending" });
    assert.deepEqual(await applyForOwnerAccess(db, guest, "apply", application), receipt);
    await assert.rejects(
      applyForOwnerAccess(db, guest, "apply", { ...application, province: "Kep" }),
      /idempotency_conflict/,
    );
    await assert.rejects(applyForOwnerAccess(db, guest, "again", application), /owner_application_pending/);
    const status = await ownerAccessStatus(db, guest);
    assert.equal(status.status, "pending");
    assert.equal(status.application?.businessName, application.businessName);
    assert.equal(status.application?.revision, 1);
    // Pending is not owner access.
    assert.equal((await capabilities(db, guest)).owner, false);
    await assert.rejects(createPropertyDraft(db, guest, "early", draft), /owner_access_required/);
    // Approved owners cannot apply again.
    await assert.rejects(applyForOwnerAccess(db, owner, "owner-apply", application), /owner_access_approved/);
  } finally {
    await p.dispose();
  }
});

test("a different active admin decides with a reason against the reviewed revision; approval enables drafts", async () => {
  const p = await database();
  try {
    const db = p.db;
    await setup(db);
    await applyForOwnerAccess(db, guest, "apply", application);
    const decision = { action: "approve", reason: "Verified by phone call.", revision: 1 };
    // Non-admins cannot see or decide applications.
    await assert.rejects(ownerApplications(db, owner), /not_found/);
    await assert.rejects(decideOwnerApplication(db, owner, "x", "guest", decision), /not_found/);
    // Admins cannot decide their own application.
    await assert.rejects(decideOwnerApplication(db, other, "self", "other", decision), /not_found/);
    for (const bad of [
      { ...decision, reason: "" },
      { ...decision, action: "maybe" },
      { ...decision, revision: 0 },
      { action: "approve", revision: 1 },
    ])
      await assert.rejects(decideOwnerApplication(db, other, "bad", "guest", bad), /invalid_owner_application/);
    await assert.rejects(
      decideOwnerApplication(db, other, "stale", "guest", { ...decision, revision: 2 }),
      /stale_owner_application/,
    );
    const queue = await ownerApplications(db, other);
    assert.deepEqual(queue.items.map((item) => [item.userId, item.businessName, item.revision]), [
      ["guest", application.businessName, 1],
    ]);
    assert.deepEqual(Object.keys(queue.items[0]).sort(), [
      "accountEmail",
      "accountName",
      "businessName",
      "phone",
      "province",
      "revision",
      "submittedAt",
      "userId",
    ]);
    const approved = await decideOwnerApplication(db, other, "approve", "guest", decision);
    assert.deepEqual(approved, { id: "guest", status: "approved" });
    assert.deepEqual(await decideOwnerApplication(db, other, "approve", "guest", decision), approved);
    await assert.rejects(
      decideOwnerApplication(db, other, "again", "guest", { ...decision, action: "decline" }),
      /stale_owner_application/,
    );
    assert.equal((await ownerApplications(db, other)).items.length, 0);
    assert.equal((await capabilities(db, guest)).owner, true);
    assert.equal((await createPropertyDraft(db, guest, "draft", draft)).status, "draft");
    assert.deepEqual(
      (await db.prepare("SELECT actor_id,actor_role,action,subject_id,reason FROM owner_access_command ORDER BY rowid").all()).results,
      [
        { actor_id: "guest", actor_role: "applicant", action: "apply", subject_id: "guest", reason: null },
        { actor_id: "other", actor_role: "admin", action: "approve", subject_id: "guest", reason: "Verified by phone call." },
      ],
    );
  } finally {
    await p.dispose();
  }
});

test("a declined applicant sees the reason and may reapply with updated details", async () => {
  const p = await database();
  try {
    const db = p.db;
    await setup(db);
    await applyForOwnerAccess(db, guest, "apply", application);
    await decideOwnerApplication(db, other, "decline", "guest", {
      action: "decline",
      reason: "Please use the property's business phone.",
      revision: 1,
    });
    const declined = await ownerAccessStatus(db, guest);
    assert.equal(declined.status, "declined");
    assert.equal(declined.declineReason, "Please use the property's business phone.");
    assert.equal((await capabilities(db, guest)).owner, false);
    await applyForOwnerAccess(db, guest, "reapply", { ...application, phone: "+855 33 111 222" });
    const again = await ownerAccessStatus(db, guest);
    assert.equal(again.status, "pending");
    assert.equal(again.declineReason, null);
    assert.equal(again.application?.revision, 2);
    assert.equal(again.application?.phone, "+855 33 111 222");
  } finally {
    await p.dispose();
  }
});

test("database guards: decisions need an in-flight admin command, approval is final, history is immutable", async () => {
  const p = await database();
  try {
    const db = p.db;
    await setup(db);
    await applyForOwnerAccess(db, guest, "apply", application);
    await assert.rejects(
      db.prepare("UPDATE owner_access SET status='approved',decided_by='other',decided_at=unixepoch() WHERE user_id='guest'").run(),
      /invalid_owner_access_decision/,
    );
    // A revoked admin is refused when the command is written.
    await db.batch(grantAdminStatements(db, "other", false));
    await assert.rejects(
      decideOwnerApplication(db, other, "revoked", "guest", { action: "approve", reason: "Looks fine.", revision: 1 }),
      /not_found/,
    );
    await assert.rejects(
      db
        .prepare(
          "INSERT INTO owner_access_command(id,actor_id,actor_role,key,fingerprint,action,subject_id,reason) VALUES('c','other','admin','k','f','approve','guest','Late')",
        )
        .run(),
      /invalid_owner_access_actor/,
    );
    await db.batch(grantAdminStatements(db, "other"));
    await decideOwnerApplication(db, other, "approve", "guest", { action: "approve", reason: "Looks fine.", revision: 1 });
    await assert.rejects(
      db.prepare("UPDATE owner_access SET status='declined' WHERE user_id='guest'").run(),
      /invalid_owner_access_decision/,
    );
    await assert.rejects(db.prepare("UPDATE owner_access_command SET reason='changed'").run(), /immutable_owner_access_command/);
    await assert.rejects(db.prepare("DELETE FROM owner_access_command").run(), /immutable_owner_access_command/);
    // A property row needs approved owner access, even when written directly.
    await assert.rejects(
      db
        .prepare(
          "INSERT INTO property(id,owner_id,checkin_time,checkout_time,policy_version,policy_text,terms_version) VALUES('direct','unverified','14:00','11:00','v1','Rules','v1')",
        )
        .run(),
      /owner_access_required|FOREIGN KEY/,
    );
    assert.equal(await scalar(db, "SELECT count(*) n FROM owner_access_command"), 2);
  } finally {
    await p.dispose();
  }
});
