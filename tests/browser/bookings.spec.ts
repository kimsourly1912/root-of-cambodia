import {
  test,
  expect,
  devices,
  type APIRequestContext,
} from "@playwright/test";
import { createHash } from "node:crypto";
import photos from "../photo-fixtures.json" with { type: "json" };
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
    await account(owner, `guest-owner-${info.project.name}@example.invalid`);
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
