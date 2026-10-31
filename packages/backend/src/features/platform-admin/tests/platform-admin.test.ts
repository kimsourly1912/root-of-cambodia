import { test } from "vitest";
import assert from "node:assert/strict";
import {
  database,
  catalog,
  guest,
  owner,
  other,
  request,
  configureReviewer,
  approveOwner,
} from "../../../testing/support";
import { adminOverview, adminProperties } from "@root-of-cambodia/backend/platform-admin";
import { applyForOwnerAccess } from "@root-of-cambodia/backend/owner-access";
import { createPropertyDraft } from "@root-of-cambodia/backend/properties";

const draft = {
  ownerName: "Guest Owner",
  nameKm: "ផ្ទះ",
  nameEn: "Draft",
  province: "Kep",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet.",
};

test("only active admins read the console; counts and listing states carry no guest or private data", async () => {
  const p = await database();
  try {
    const db = p.db;
    const { input } = await catalog(db);
    await request(db, input);
    await configureReviewer(db, "other", "approved-v1");
    await assert.rejects(adminOverview(db, owner), /not_found/);
    await assert.rejects(adminProperties(db, guest), /not_found/);
    await applyForOwnerAccess(db, guest, "apply", { businessName: "Guest stay", phone: "+855 12 345 678", province: "Kep" });
    assert.deepEqual(await adminOverview(db, other), {
      pendingOwnerApplications: 1,
      pendingPublicationReviews: 0,
      approvedOwners: 2,
      activeAdmins: 1,
      properties: { draft: 0, review: 0, published: 2, paused: 0 },
    });
    const all = await adminProperties(db, other);
    assert.deepEqual(all.items.map((item) => [item.id, item.publication, item.ownerName, item.roomTypes]), [
      ["other", "published", "Other", 1],
      ["p", "published", "Owner", 2],
    ]);
    // An exact field allowlist: no guest, booking, contact, address or owner account fields.
    assert.deepEqual(Object.keys(all.items[0]).sort(), [
      "id",
      "nameEn",
      "nameKm",
      "ownerName",
      "province",
      "publication",
      "roomTypes",
    ]);
    assert.ok(!JSON.stringify(all).includes("guest@"));
    assert.deepEqual((await adminProperties(db, other, { publication: "draft" })).items, []);
    await assert.rejects(adminProperties(db, other, { publication: "deleted" }), /invalid_request/);
  } finally {
    await p.dispose();
  }
});

test("the property directory filters by state and pages by id", async () => {
  const p = await database();
  try {
    const db = p.db;
    await catalog(db);
    await configureReviewer(db, "other", "approved-v1");
    await approveOwner(db, "guest");
    for (let i = 0; i < 21; i++) await createPropertyDraft(db, guest, "draft-" + i, draft);
    const drafts = await adminProperties(db, other, { publication: "draft" });
    assert.equal(drafts.items.length, 20);
    assert.ok(drafts.nextCursor);
    const next = await adminProperties(db, other, { publication: "draft", cursor: drafts.nextCursor! });
    assert.equal(next.items.length, 1);
    assert.equal(next.nextCursor, null);
    assert.ok(drafts.items.every((item) => item.publication === "draft" && item.ownerName === "Guest Owner"));
    assert.equal((await adminOverview(db, other)).properties.draft, 21);
  } finally {
    await p.dispose();
  }
});
