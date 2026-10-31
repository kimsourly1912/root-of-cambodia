import {
  test,
  expect,
  devices,
  type APIRequestContext,
} from "@playwright/test";
import { createHash } from "node:crypto";
import photos from "../../packages/backend/src/testing/photo-fixtures.json" with { type: "json" };
const origin = "http://127.0.0.1:8787",
  password = "LocalOnly-GuestPassword-123!";
async function account(
  request: APIRequestContext,
  email: string,
  signIn = true,
) {
  const created = await request.post("/api/auth/sign-up/email", {
    headers: { Origin: origin },
    data: { name: "Local Guest", email, password },
  });
  expect(created.ok()).toBeTruthy();
  const mail = await (
    await request.get(`/__test/mail?email=${encodeURIComponent(email)}`)
  ).json();
  expect((await request.get(mail.url)).ok()).toBeTruthy();
  if (signIn)
    expect(
      (
        await request.post("/api/auth/sign-in/email", {
          headers: { Origin: origin },
          data: { email, password },
        })
      ).ok(),
    ).toBeTruthy();
  return (await created.json()).user.id as string;
}
async function post(
  request: APIRequestContext,
  path: string,
  data: unknown,
  method: "post" | "patch" = "post",
) {
  const r = await request[method](path, {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data,
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
test("guest and owner recover requests/responses and reveal logistics only while confirmed", async ({
  page,
  browser,
}, info) => {
  const contexts = await Promise.all(
    ["owner", "reviewer"].map((role) =>
      browser.newContext({
        ...devices[
          info.project.name.startsWith("mobile") ? "Pixel 7" : "Desktop Chrome"
        ],
        baseURL: origin,
        extraHTTPHeaders: {
          "X-Test-Client": `guest-${role}-${info.project.name}`,
        },
      }),
    ),
  );
  const [owner, reviewer] = contexts.map((c) => c.request);
  await page
    .context()
    .setExtraHTTPHeaders({ "X-Test-Client": "guest-ui-" + info.project.name });
  try {
    const ownerId = await account(owner, `guest-owner-${info.project.name}@example.invalid`);
    // This journey is not about the owner application (ADR 0010).
    expect((await owner.post("/__test/owner-access", { data: { userId: ownerId } })).status()).toBe(200);
    const reviewerId = await account(
      reviewer,
      `guest-reviewer-${info.project.name}@example.invalid`,
    );
    expect(
      (
        await reviewer.post("/__test/pilot-reviewer", {
          data: {
            userId: reviewerId,
            termsVersion: "browser-approved-v1",
            termsDocument: true,
          },
        })
      ).status(),
    ).toBe(200);
    const property = await post(owner, "/api/owner/properties", {
        ownerName: "Local owner",
        nameKm: "ផ្ទះសំណាក់",
        nameEn: "Request journey stay",
        province: "Kampot",
        checkinTime: "14:00",
        checkoutTime: "11:00",
        policyText: "Quiet nights.",
      }),
      base = `/api/owner/properties/${property.id}`;
    await post(
      owner,
      base + "/information",
      {
        description: "A fictional stay for booking tests.",
        address: "PRIVATE_GUEST_ADDRESS",
        facilities: [],
        revision: null,
      },
      "patch",
    );
    await post(
      owner,
      base + "/logistics",
      {
        latitude: null,
        longitude: null,
        contactName: "Private reception",
        contactPhone: "",
        contactEmail: "private-reception@example.invalid",
        arrivalInstructions: "PRIVATE_GUEST_ARRIVAL",
        revision: null,
      },
      "patch",
    );
    const room = await post(owner, base + "/rooms", {
      name: "Garden room",
      adultCapacity: 2,
      childCapacity: 0,
      totalCapacity: 2,
    });
    const night = new Date(Date.now() + 3 * 86400000)
        .toISOString()
        .slice(0, 10),
      checkout = new Date(Date.parse(night) + 86400000)
        .toISOString()
        .slice(0, 10);
    await post(
      owner,
      base + `/rooms/${room.id}/calendar`,
      {
        roomRevision: 1,
        nights: [
          {
            night,
            capacity: 1,
            blocked: 0,
            unitCents: 3500,
            inventoryRevision: null,
            rateRevision: null,
          },
        ],
      },
      "patch",
    );
    const bytes = Buffer.from(photos.jpeg, "base64"),
      photo = await post(owner, base + "/photos", {
        contentType: "image/jpeg",
        byteSize: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        revision: null,
      });
    expect(
      (
        await owner.put(base + "/photos/" + photo.id, {
          headers: { Origin: origin, "Content-Type": "image/jpeg" },
          data: bytes,
        })
      ).status(),
    ).toBe(200);
    const state = await (await owner.get(base + "/review")).json();
    const review = await post(owner, base + "/review", {
      action: "submit",
      propertyRevision: state.propertyRevision,
      publicDisclosure: {
        version: state.publicPreview.version,
        previewHash: state.publicPreview.previewHash,
      },
    });
    await post(reviewer, "/api/property-reviews/" + review.id, {
      action: "approve",
      revision: 1,
      configRevision: (
        await (await reviewer.get("/api/property-reviews/" + review.id)).json()
      ).configRevision,
    });
    const email = `guest-ui-${info.project.name}@example.invalid`;
    await account(page.request, email, false);
    await page.goto(`/stays/${property.id}`);
    await page
      .getByRole("link", { name: "Request to book", exact: true })
      .click();
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/stays/${property.id}/request$`));
    // Inputs must not accept a selection before hydration can preserve it.
    let releaseRequestScripts!: () => void;
    const requestScriptsReady = new Promise<void>((resolve) => {
      releaseRequestScripts = resolve;
    });
    await page.route("**/_next/static/**/*.js*", async (route) => {
      await requestScriptsReady;
      await route.continue();
    });
    try {
      await page.reload({ waitUntil: "commit" });
      await expect(page.getByLabel("Check-in date", { exact: true })).toBeDisabled();
      await expect(page.getByLabel("Check-out date", { exact: true })).toBeDisabled();
      await expect(page.getByLabel("Rooms / units", { exact: true })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Review request", exact: true })).toBeDisabled();
    } finally {
      releaseRequestScripts();
      await page.unrouteAll({ behavior: "wait" });
    }
    await page.getByLabel("Check-in date", { exact: true }).fill(night);
    await page.getByLabel("Check-out date", { exact: true }).fill(checkout);
    await page.getByLabel("Rooms / units", { exact: true }).fill("1");
    await page
      .getByRole("button", { name: "Review request", exact: true })
      .click();
    await expect(page).toHaveURL(/\/bookings\/requests\/[0-9a-f-]+$/);
    const attemptURL = page.url();
    await expect(
      page.getByText("$35.00 USD", { exact: true }).last(),
    ).toBeVisible();
    expect(await page.locator("main").textContent()).not.toContain(
      "PRIVATE_GUEST_ADDRESS",
    );
    await page.getByRole("checkbox").check();
    let sentURL = "";
    await page.route(
      "**/api/guest/attempts/*/send",
      async (route) => {
        sentURL = route.request().url();
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Send request to owner", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry same request", exact: true }),
    ).toBeVisible();
    expect(sentURL).toContain(new URL(attemptURL).pathname.split("/").at(-1));
    // Reload reconciles a successful stored receipt; no replacement operation.
    await page.reload();
    await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+$/);
    const bookingURL = page.url(),
      id = new URL(bookingURL).pathname.split("/").at(-1)!;
    await expect(
      page.getByText("Pending confirmation", { exact: true }).first(),
    ).toBeVisible();
    const privateRead = await page.request.get(`/api/guest/bookings/${id}`);
    expect(privateRead.headers()["cache-control"]).toContain("no-store");
    expect(JSON.stringify(await privateRead.json())).not.toContain(
      "PRIVATE_GUEST_ADDRESS",
    );
    await page.getByRole("link", { name: "My bookings", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "View booking", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("link", { name: "View booking", exact: true }).click();
    let firstKey = "",
      retryKey = "";
    await page.route(
      `**/api/bookings/${id}/cancel_guest`,
      async (route) => {
        firstKey = route.request().headers()["idempotency-key"];
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Cancel request", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Confirm cancellation", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Retry same cancellation",
        exact: true,
      }),
    ).toBeVisible();
    await page.route(
      `**/api/bookings/${id}/cancel_guest`,
      async (route) => {
        retryKey = route.request().headers()["idempotency-key"];
        await route.continue();
      },
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Retry same cancellation", exact: true })
      .click();
    await expect(
      page.getByText("Cancelled", { exact: true }).first(),
    ).toBeVisible();
    expect(retryKey).toBe(firstKey);
    await page.goto(attemptURL);
    await expect(page).toHaveURL(bookingURL);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    // Continue the real UI journey as the owner; new requests follow the same reviewed engine.
    async function anotherRequest() {
      await page.goto(`/stays/${property.id}/request`);
      await page.getByLabel("Check-in date", { exact: true }).fill(night);
      await page.getByLabel("Check-out date", { exact: true }).fill(checkout);
      await page.getByLabel("Rooms / units", { exact: true }).fill("1");
      await page
        .getByRole("button", { name: "Review request", exact: true })
        .click();
      await expect(page).toHaveURL(/\/bookings\/requests\/[0-9a-f-]+$/);
      await page.getByRole("checkbox").check();
      await page
        .getByRole("button", { name: "Send request to owner", exact: true })
        .click();
      await expect(page).toHaveURL(/\/bookings\/[0-9a-f-]+$/);
      return page.url();
    }
    const secondURL = await anotherRequest();
    const ownerPage = await contexts[0].newPage();
    await ownerPage.goto(`/owner/properties/${property.id}/bookings`);
    await ownerPage
      .locator("li")
      .filter({ hasText: "Pending confirmation" })
      .getByRole("link", { name: "View request", exact: true })
      .click();
    await expect(
      ownerPage.getByText("PRIVATE_GUEST_ADDRESS", { exact: true }),
    ).toBeVisible();
    await ownerPage.getByRole("checkbox").check();
    await ownerPage
      .getByRole("button", { name: "Review response", exact: true })
      .click();
    await expect(ownerPage).toHaveURL(/response=/);
    await ownerPage.route(
      "**/api/owner/bookings/*/attempts/*/apply",
      async (route) => {
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await ownerPage
      .getByRole("button", { name: "Accept and confirm stay", exact: true })
      .click();
    await expect(
      ownerPage.getByRole("button", {
        name: "Retry same response",
        exact: true,
      }),
    ).toBeVisible();
    await ownerPage.reload();
    await expect(ownerPage).not.toHaveURL(/response=/);
    await expect(
      ownerPage.getByText("Confirmed", { exact: true }).first(),
    ).toBeVisible();
    await page.goto(secondURL);
    await expect(
      page.getByText("PRIVATE_GUEST_ADDRESS", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("PRIVATE_GUEST_ARRIVAL", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    expect(
      await ownerPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await ownerPage
      .getByLabel("Cancellation reason (required)")
      .fill("Property cannot host this stay.");
    await ownerPage
      .getByRole("button", { name: "Review response", exact: true })
      .click();
    await ownerPage
      .getByRole("button", { name: "Cancel booking", exact: true })
      .click();
    await expect(
      ownerPage.getByText("Cancelled", { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Cancelled", { exact: true }).first(),
    ).toBeVisible();
    expect(await page.locator("main").textContent()).not.toContain(
      "PRIVATE_GUEST_ADDRESS",
    );
    const thirdURL = await anotherRequest();
    await ownerPage.goto(`/owner/properties/${property.id}/bookings`);
    await ownerPage
      .locator("li")
      .filter({ hasText: "Pending confirmation" })
      .getByRole("link", { name: "View request", exact: true })
      .click();
    await ownerPage
      .getByLabel("Response", { exact: true })
      .selectOption("decline");
    await ownerPage
      .getByRole("button", { name: "Review response", exact: true })
      .click();
    await ownerPage
      .getByRole("button", { name: "Decline request", exact: true })
      .click();
    await expect(
      ownerPage.getByText("Declined", { exact: true }).first(),
    ).toBeVisible();
    await page.goto(thirdURL);
    await expect(
      page.getByText("Declined", { exact: true }).first(),
    ).toBeVisible();
    expect(await page.locator("main").textContent()).not.toContain(
      "PRIVATE_GUEST_ADDRESS",
    );
    // A fourth stay follows the new arrival/completion UI, with only this fixture's DB clock adjusted.
    const fourthURL = await anotherRequest(),
      fourthId = new URL(fourthURL).pathname.split("/").at(-1)!;
    await ownerPage.goto(
      `/owner/properties/${property.id}/bookings/${fourthId}`,
    );
    await ownerPage.getByRole("checkbox").first().check();
    await ownerPage
      .getByRole("button", { name: "Review response", exact: true })
      .click();
    await ownerPage
      .getByRole("button", { name: "Accept and confirm stay", exact: true })
      .click();
    await expect(
      ownerPage.getByText("Confirmed", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      ownerPage.getByRole("button", {
        name: "Mark guest checked in",
        exact: true,
      }),
    ).toBeDisabled();
    const instant = Math.floor(Date.parse(night + "T14:00:00+07:00") / 1000);
    expect(
      (
        await owner.post("/__test/stay-clock", {
          data: { bookingId: fourthId, instant },
        })
      ).status(),
    ).toBe(200);
    await ownerPage.clock.setFixedTime(new Date(instant * 1000));
    await ownerPage.reload();
    await ownerPage
      .getByLabel("The guest has arrived at the property.", { exact: true })
      .check();
    await ownerPage.route(
      `**/api/bookings/${fourthId}/check_in`,
      async (route) => {
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await ownerPage
      .getByRole("button", { name: "Mark guest checked in", exact: true })
      .click();
    await expect(
      ownerPage.getByRole("button", {
        name: "Retry same stay update",
        exact: true,
      }),
    ).toBeVisible();
    await ownerPage.reload();
    await expect(ownerPage).not.toHaveURL(/stayAttempt=/);
    await expect(
      ownerPage.getByText("Checked in", { exact: true }).first(),
    ).toBeVisible();
    // Completion must not natively navigate when scripts have not hydrated its form.
    let releaseStayScripts!:()=>void;
    const stayScriptsReady=new Promise<void>(resolve=>{releaseStayScripts=resolve;});
    await ownerPage.route("**/_next/static/**/*.js*",async route=>{await stayScriptsReady;await route.continue();});
    try {
      await ownerPage.reload({waitUntil:"commit"});
      await expect(ownerPage.getByLabel("The guest has left and this stay is finished.",{exact:true})).toBeDisabled();
      await expect(ownerPage.getByRole("button",{name:"Mark stay completed",exact:true})).toBeDisabled();
    } finally {
      releaseStayScripts();
      // The one-shot lost check-in hook above has completed; drain only the delayed scripts.
      await ownerPage.unrouteAll({behavior:"wait"});
    }
    await ownerPage.waitForLoadState("load");
    await ownerPage
      .getByLabel("The guest has left and this stay is finished.", {
        exact: true,
      })
      .check();
    await ownerPage
      .getByRole("button", { name: "Mark stay completed", exact: true })
      .click();
    await expect(
      ownerPage.getByText("Completed", { exact: true }).first(),
    ).toBeVisible();
    await page.goto(fourthURL);
    await expect(
      page.getByText("Completed", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Payment not recorded", { exact: true }),
    ).toBeVisible();
    // Completion is independent of payment. Recording is owner bookkeeping with recoverable reviews.
    const paymentPanel = ownerPage
      .getByRole("heading", { name: "Payment at the property", exact: true })
      .locator("..");
    await paymentPanel.getByRole("checkbox").check();
    await ownerPage
      .getByRole("button", { name: "Review payment record", exact: true })
      .click();
    await expect(ownerPage).toHaveURL(/paymentAttempt=/);
    await expect(
      ownerPage.getByRole("heading", {
        name: "Review saved payment update",
        exact: true,
      }),
    ).toBeVisible();
    await ownerPage.route(
      `**/api/owner/bookings/${fourthId}/payments/attempts/*/apply`,
      async (route) => {
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await ownerPage
      .getByRole("button", { name: "Record full payment", exact: true })
      .click();
    await expect(
      ownerPage.getByRole("button", {
        name: "Retry same payment update",
        exact: true,
      }),
    ).toBeVisible();
    await ownerPage.reload();
    await expect(ownerPage).not.toHaveURL(/paymentAttempt=/);
    await expect(
      ownerPage.getByText("Payment recorded", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Property marked full payment recorded", { exact: true }),
    ).toBeVisible();
    await paymentPanel.getByRole("checkbox").check();
    await ownerPage
      .getByLabel("Correction reason (owner-private)", { exact: true })
      .fill("PRIVATE_PAYMENT_CORRECTION");
    await ownerPage
      .getByRole("button", { name: "Review correction", exact: true })
      .click();
    await ownerPage
      .getByRole("button", { name: "Void mistaken record", exact: true })
      .click();
    await expect(ownerPage).not.toHaveURL(/paymentAttempt=/);
    await expect(
      ownerPage.getByText("Mistaken record voided", { exact: false }),
    ).toBeVisible();
    await expect(
      ownerPage.getByText("Full payment recorded", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Payment not recorded", { exact: true }),
    ).toBeVisible();
    expect(await page.locator("main").textContent()).not.toContain(
      "PRIVATE_PAYMENT_CORRECTION",
    );
    const guestPayment = await page.request.get(
      `/api/guest/bookings/${fourthId}`,
    );
    expect(guestPayment.status()).toBe(200);
    expect(await guestPayment.text()).not.toContain(
      "PRIVATE_PAYMENT_CORRECTION",
    );
    expect(await page.locator("main").textContent()).not.toContain(
      "PRIVATE_GUEST_ADDRESS",
    );
    const outsider = await browser.newContext({
      baseURL: origin,
      extraHTTPHeaders: { "X-Test-Client": "guest-other-" + info.project.name },
    });
    try {
      await account(
        outsider.request,
        `guest-other-${info.project.name}@example.invalid`,
      );
      expect(
        (await outsider.request.get(`/api/guest/bookings/${id}`)).status(),
      ).toBe(404);
      expect(
        (
          await outsider.request.get(
            `/api/guest/attempts/${attemptURL.split("/").at(-1)}`,
          )
        ).status(),
      ).toBe(404);
    } finally {
      await outsider.close();
    }
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
