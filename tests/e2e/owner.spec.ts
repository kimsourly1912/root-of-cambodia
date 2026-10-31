import {
  test,
  expect,
  devices,
  type Page,
  type APIRequestContext,
  type Route,
} from "@playwright/test";
import photoFixtures from "../../packages/backend/src/testing/photo-fixtures.json" with { type: "json" };
test.beforeEach(async ({ page }, info) => {
  await page.context().setExtraHTTPHeaders({
    "X-Test-Client": info.project.name + ":" + info.title,
  });
});
const password = "LocalOnly-BrowserPassword-123!";
const fields = {
  nameKm: "ផ្ទះសំណាក់",
  nameEn: "River House",
  province: "Kampot",
  checkinTime: "14:00",
  checkoutTime: "11:00",
  policyText: "Quiet hours after 22:00.",
};
async function assertFormHydration(page: Page, fieldLabel: string, saveLabel: string) {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
  const deferScripts = async (route: Route) => { await scriptsReady; await route.continue(); };
  await page.route("**/_next/static/**/*.js*", deferScripts);
  try {
    await page.reload({ waitUntil: "commit" });
    await expect(page.getByLabel(fieldLabel, { exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: saveLabel, exact: true })).toBeDisabled();
  } finally {
    releaseScripts();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(page.getByLabel(fieldLabel, { exact: true })).toBeEnabled();
}
async function emailLink(
  request: APIRequestContext,
  email: string,
  kind = "verify",
) {
  const response = await request.get(
    `/__test/mail?email=${encodeURIComponent(email)}&kind=${kind}`,
  );
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { url: string }).url;
}
async function signIn(page: Page, email: string, pass = password) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(pass);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/owner$/);
}
async function register(page: Page, email: string, ownerAccess = true) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Local Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await page.goto(await emailLink(page.request, email));
  await expect(page).toHaveURL(/\/sign-in\?verified=1/);
  await signIn(page, email);
  if (!ownerAccess) return;
  await grantOwnerAccess(page.request);
  await page.reload();
}
// Journeys that are not about the owner application get owner access directly (ADR 0010).
async function grantOwnerAccess(request: APIRequestContext) {
  const session = (await (await request.get("/api/auth/get-session")).json()) as { user: { id: string } };
  expect((await request.post("/__test/owner-access", { data: { userId: session.user.id } })).status()).toBe(200);
}
test("sign-in password visibility control is accessible and reversible", async ({
  page,
}) => {
  await page.goto("/sign-in");
  const passwordField = page.getByLabel("Password", { exact: true });
  await expect(passwordField).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(passwordField).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(passwordField).toHaveAttribute("type", "password");
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Resend verification email" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("verified owner creates, retries, edits, resolves a stale tab and reopens a private property", async ({
  page,
}, info) => {
  const email = `owner-${info.project.name}@example.invalid`;
  await page.goto("/owner");
  await expect(page).toHaveURL(/\/sign-in$/);
  await register(page, email);
  await expect(
    page.getByRole("heading", { name: "Your first property starts here" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Create property draft", exact: true })
    .click();
  await page.getByLabel(/Property name in Khmer/).fill(fields.nameKm);
  await page.getByLabel(/Property name in English/).fill(fields.nameEn);
  await page.getByLabel(/Province/).fill(fields.province);
  await page
    .getByLabel("Check-in time", { exact: true })
    .fill(fields.checkinTime);
  await page
    .getByLabel("Check-out time", { exact: true })
    .fill(fields.checkoutTime);
  await page.getByLabel("Property house rules").fill(fields.policyText);
  // Commit the first request but lose its response. Retry must preserve the key/body.
  let firstKey = "";
  let retryKey = "";
  await page.route(
    "**/api/owner/properties",
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      firstKey = route.request().headers()["idempotency-key"];
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same save" }),
  ).toBeVisible();
  await expect(page.getByLabel(/Property name in Khmer/)).toBeDisabled();
  await page.route(
    "**/api/owner/properties",
    async (route) => {
      retryKey = route.request().headers()["idempotency-key"];
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Retry same save" }).click();
  await expect(page).toHaveURL(/\/owner\/properties\/[0-9a-f-]+$/);
  expect(retryKey).toBe(firstKey);
  const url = page.url();
  const apiPath = new URL(url).pathname.replace("/owner/", "/api/owner/");
  await expect(page.getByLabel(/Property name in English/)).toHaveValue(
    "River House",
  );
  const stale = await page.context().newPage();
  await stale.goto(url);
  await page.getByLabel(/Property name in English/).fill("River House Updated");
  await page
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Draft saved.");
  await expect(
    page.getByRole("button", { name: "Save private draft", exact: true }),
  ).toBeEnabled();
  await stale.getByLabel(/Property name in English/).fill("Stale name");
  await stale
    .getByRole("button", { name: "Save private draft", exact: true })
    .click();
  await expect(stale.locator("main").getByRole("alert")).toContainText(
    "property changed",
  );
  await stale.getByRole("button", { name: "Reload latest version" }).click();
  await expect(stale.getByLabel(/Property name in English/)).toHaveValue(
    "River House Updated",
  );
  await stale.close();
  await page.reload();
  await expect(page.getByLabel(/Property name in English/)).toHaveValue(
    "River House Updated",
  );
  const response = await page.request.get(apiPath);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["cache-control"]).toContain("no-store");
  const stored = await response.json();
  expect(stored.publication).toBe("draft");
  expect(stored.revision).toBe(2);
  expect(
    (
      await page.request.patch(apiPath, {
        headers: {
          Origin: "https://untrusted.example.invalid",
          "Idempotency-Key": "cross-origin",
        },
        data: { ...fields, revision: 2 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(apiPath, {
        headers: { Origin: "http://127.0.0.1:8787" },
        data: { ...fields, revision: 2 },
      })
    ).status(),
  ).toBe(422);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `/tmp/roc-step6/${info.project.name}-draft.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Back to your properties", exact: true })
    .click();
  await expect(page.getByRole("link", { name: "Open property →" })).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto(url);
  await expect(page).toHaveURL(/\/sign-in$/);
  const other = `other-${info.project.name}@example.invalid`;
  await register(page, other);
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Property unavailable" }),
  ).toBeVisible();
  expect((await page.request.get(apiPath)).status()).toBe(404);
  expect(
    (
      await page.request.patch(apiPath, {
        headers: {
          Origin: "http://127.0.0.1:8787",
          "Idempotency-Key": "other-edit",
        },
        data: { ...fields, revision: 2 },
      })
    ).status(),
  ).toBe(404);
});
test("verification resend and password reset use the captured real authentication links", async ({
  page,
}, info) => {
  const email = `reset-${info.project.name}@example.invalid`;
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Reset Owner");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "verify your email",
  );
  await page.getByRole("link", { name: "Resend verification email" }).click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send verification link" }).click();
  await expect(page.getByRole("status")).toContainText(
    "link has been requested",
  );
  await page.goto(await emailLink(page.request, email));
  await expect(page).toHaveURL(/\/sign-in\?verified=1/);
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto(await emailLink(page.request, email, "reset"));
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  const next = password + "New";
  await page.getByLabel("Password", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  await signIn(page, email, next);
});

test("owner creates and edits room types with safe retries, stale-tab protection and private property scoping", async ({
  page,
}, info) => {
  const email = `rooms-${info.project.name}@example.invalid`;
  await register(page, email);
  const headers = {
    Origin: "http://127.0.0.1:8787",
    "Idempotency-Key": "room-property",
  };
  const created = await page.request.post("/api/owner/properties", {
    headers,
    data: { ...fields, ownerName: "Local Owner" },
  });
  expect(created.status()).toBe(201);
  const property = (await created.json()) as { id: string };
  const base = `/owner/properties/${property.id}/rooms`,
    apiBase = "/api" + base;
  await page.goto(`/owner/properties/${property.id}`);
  await page.getByRole("link", { name: "Room types", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No room types yet" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create first room type" }).click();
  await page.getByLabel(/Room type name/).fill("Twin room");
  await page.getByLabel("Maximum adults", { exact: true }).fill("2");
  await page.getByLabel("Maximum children", { exact: true }).fill("1");
  await page.getByLabel("Maximum total guests", { exact: true }).fill("3");
  let firstKey = "",
    firstBody = "",
    retryKey = "",
    retryBody = "";
  await page.route(
    "**" + apiBase,
    async (route) => {
      firstKey = route.request().headers()["idempotency-key"];
      firstBody = route.request().postData() ?? "";
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Save room type", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same save" }),
  ).toBeVisible();
  await expect(page.getByLabel(/Room type name/)).toBeDisabled();
  await page.route(
    "**" + apiBase,
    async (route) => {
      retryKey = route.request().headers()["idempotency-key"];
      retryBody = route.request().postData() ?? "";
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Retry same save" }).click();
  await expect(page).toHaveURL(new RegExp(base + "/[0-9a-f-]+$"));
  expect(retryKey).toBe(firstKey);
  expect(retryBody).toBe(firstBody);
  const roomURL = page.url(),
    apiRoom = "/api" + new URL(roomURL).pathname;
  const stale = await page.context().newPage();
  await stale.goto(roomURL);
  await page.getByLabel(/Room type name/).fill("Garden twin");
  await page
    .getByRole("button", { name: "Save room type", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Room type saved.");
  await expect(
    page.getByRole("button", { name: "Save room type", exact: true }),
  ).toBeEnabled();
  await stale.getByLabel(/Room type name/).fill("Stale twin");
  await stale
    .getByRole("button", { name: "Save room type", exact: true })
    .click();
  await expect(stale.locator("main").getByRole("alert")).toContainText(
    "changed since you opened it",
  );
  await stale.getByRole("button", { name: "Reload latest details" }).click();
  await expect(stale.getByLabel(/Room type name/)).toHaveValue("Garden twin");
  await stale.close();
  await page.reload();
  await expect(page.getByLabel(/Room type name/)).toHaveValue("Garden twin");
  await expect(
    page.getByLabel("Maximum total guests", { exact: true }),
  ).toHaveValue("3");
  const read = await page.request.get(apiRoom);
  expect(read.status()).toBe(200);
  expect(read.headers()["cache-control"]).toContain("no-store");
  const room = await read.json();
  expect(room.revision).toBe(2);
  expect(room.propertyId).toBe(property.id);
  expect(
    (
      await page.request.patch(apiRoom, {
        headers: {
          Origin: "https://untrusted.example.invalid",
          "Idempotency-Key": "bad-origin",
        },
        data: {
          name: "No",
          adultCapacity: 2,
          childCapacity: 1,
          totalCapacity: 3,
          revision: 2,
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(apiRoom, {
        headers,
        data: {
          name: "No",
          adultCapacity: 2,
          childCapacity: 1,
          totalCapacity: 3,
          revision: 2,
          quantity: 2,
        },
      })
    ).status(),
  ).toBe(422);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `/tmp/roc-rooms/${info.project.name}-room.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Back to room types", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Open room type →" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Garden twin", exact: true }),
  ).toBeVisible();
  const second = await page.request.post("/api/owner/properties", {
    headers: { ...headers, "Idempotency-Key": "second-room-property" },
    data: { ...fields, ownerName: "Local Owner" },
  });
  expect(second.status()).toBe(201);
  const secondProperty = await second.json();
  const wrongPair = `/api/owner/properties/${secondProperty.id}/rooms/${room.id}`;
  expect((await page.request.get(wrongPair)).status()).toBe(404);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await register(page, `rooms-other-${info.project.name}@example.invalid`);
  expect((await page.request.get(apiBase)).status()).toBe(404);
  expect((await page.request.get(apiRoom)).status()).toBe(404);
  expect(
    (
      await page.request.patch(apiRoom, {
        headers,
        data: {
          name: "No",
          adultCapacity: 2,
          childCapacity: 1,
          totalCapacity: 3,
          revision: 2,
        },
      })
    ).status(),
  ).toBe(404);
  await page.goto(roomURL);
  await expect(
    page.getByRole("heading", { name: "Property unavailable" }),
  ).toBeVisible();
});

test("owner sets weekly prices and units with exact cents, atomic retry and stale-calendar protection", async ({
  page,
}, info) => {
  await register(page, `calendar-${info.project.name}@example.invalid`);
  const headers = {
    Origin: "http://127.0.0.1:8787",
    "Idempotency-Key": "calendar-property",
  };
  const propertyResponse = await page.request.post("/api/owner/properties", {
    headers,
    data: { ...fields, ownerName: "Local Owner" },
  });
  expect(propertyResponse.status()).toBe(201);
  const property = await propertyResponse.json();
  const rooms = `/owner/properties/${property.id}/rooms`;
  const roomResponse = await page.request.post("/api" + rooms, {
    headers: { ...headers, "Idempotency-Key": "calendar-room" },
    data: {
      name: "Twin",
      adultCapacity: 2,
      childCapacity: 1,
      totalCapacity: 3,
    },
  });
  expect(roomResponse.status()).toBe(201);
  const room = await roomResponse.json();
  const calendar = `${rooms}/${room.id}/calendar`,
    api = "/api" + calendar;
  await page.goto(`${rooms}/${room.id}`);
  await page
    .getByRole("link", { name: "Prices and availability →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Prices and availability", exact: true }),
  ).toBeVisible();
  await page.getByLabel("First night", { exact: true }).fill("2027-01-03");
  await page.getByRole("button", { name: "Show week", exact: true }).click();
  await expect(page).toHaveURL(/start=2027-01-03/);
  const first = page.getByRole("group", { name: "2027-01-03", exact: true });
  await expect(first).toBeVisible();
  await assertFormHydration(page, "Total units for week", "Save changed nights");
  await page
    .getByLabel("Nightly price for week (USD)", { exact: true })
    .fill("19.99");
  await page.getByLabel("Total units for week", { exact: true }).fill("3");
  await page.getByLabel("Blocked units for week", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Apply to seven nights", exact: true })
    .click();
  let key = "",
    body = "",
    retryKey = "",
    retryBody = "";
  await page.route(
    "**" + api,
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      key = route.request().headers()["idempotency-key"];
      body = route.request().postData() ?? "";
      expect((await route.fetch()).status()).toBe(200);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Save changed nights", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same save" }),
  ).toBeVisible();
  await expect(first.getByLabel("Total units", { exact: true })).toBeDisabled();
  await page.route(
    "**" + api,
    async (route) => {
      retryKey = route.request().headers()["idempotency-key"];
      retryBody = route.request().postData() ?? "";
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Retry same save" }).click();
  await expect(page.getByRole("status")).toContainText("Calendar saved.");
  await expect(first.getByLabel("Total units", { exact: true })).toBeEnabled();
  expect(retryKey).toBe(key);
  expect(retryBody).toBe(body);
  expect(JSON.parse(body).nights).toHaveLength(7);
  expect(JSON.parse(body).nights[0]).not.toHaveProperty("reserved");
  let read = await page.request.get(api + "?start=2027-01-03");
  expect(read.status()).toBe(200);
  expect(read.headers()["cache-control"]).toContain("no-store");
  let saved = await read.json();
  expect(
    saved.nights.every(
      (n: {
        unitCents: number;
        capacity: number;
        blocked: number;
        reserved: number;
        inventoryRevision: number;
        rateRevision: number;
      }) =>
        n.unitCents === 1999 &&
        n.capacity === 3 &&
        n.blocked === 1 &&
        n.reserved === 0 &&
        n.inventoryRevision === 1 &&
        n.rateRevision === 1,
    ),
  ).toBeTruthy();
  const stale = await page.context().newPage();
  await stale.goto(page.url());
  await first.getByLabel("Nightly price (USD)", { exact: true }).fill("20.01");
  await page
    .getByRole("button", { name: "Save changed nights", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Calendar saved.");
  await expect(first.getByLabel("Total units", { exact: true })).toBeEnabled();
  const staleNight = stale.getByRole("group", {
    name: "2027-01-03",
    exact: true,
  });
  await staleNight.getByLabel("Total units", { exact: true }).fill("2");
  await stale
    .getByRole("button", { name: "Save changed nights", exact: true })
    .click();
  await expect(stale.locator("main").getByRole("alert")).toContainText(
    "changed since you opened this week",
  );
  await stale.getByRole("button", { name: "Reload latest week" }).click();
  await expect(
    staleNight.getByLabel("Nightly price (USD)", { exact: true }),
  ).toHaveValue("20.01");
  await stale.close();
  read = await page.request.get(api + "?start=2027-01-03");
  saved = await read.json();
  expect(saved.nights[0].unitCents).toBe(2001);
  expect(saved.nights[0].rateRevision).toBe(2);
  expect(
    saved.nights
      .slice(1)
      .every(
        (n: { unitCents: number; rateRevision: number }) =>
          n.unitCents === 1999 && n.rateRevision === 1,
      ),
  ).toBeTruthy();
  await page.reload();
  await expect(
    first.getByLabel("Nightly price (USD)", { exact: true }),
  ).toHaveValue("20.01");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `/tmp/roc-calendar/${info.project.name}-calendar.png`,
    fullPage: true,
  });
  const second = page.getByRole("group", { name: "2027-01-04", exact: true });
  await second
    .getByLabel("Nightly price (USD)", { exact: true })
    .fill("19.999");
  await page
    .getByRole("button", { name: "Save changed nights", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "enter a valid price",
  );
  await expect(page.getByRole("link", { name: "Sign in again" })).toHaveCount(
    0,
  );
  expect(
    (
      await page.request.post("/api/booking-quotes", {
        headers,
        data: {
          propertyId: property.id,
          checkin: "2027-01-03",
          checkout: "2027-01-04",
          termsVersion: "unconfigured",
          lines: [{ roomId: room.id, quantity: 1, adults: 1, children: 0 }],
        },
      })
    ).status(),
  ).toBe(404);
  await page.getByRole("link", { name: "Next week →", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "2027-01-10", exact: true }),
  ).toContainText("Not fully set");
  await page
    .getByRole("link", { name: "← Previous week", exact: true })
    .click();
  await expect(
    first.getByLabel("Nightly price (USD)", { exact: true }),
  ).toHaveValue("20.01");
  const otherProperty = await page.request.post("/api/owner/properties", {
    headers: { ...headers, "Idempotency-Key": "calendar-other-property" },
    data: { ...fields, ownerName: "Local Owner" },
  });
  const other = await otherProperty.json();
  expect(
    (
      await page.request.get(
        `/api/owner/properties/${other.id}/rooms/${room.id}/calendar?start=2027-01-03`,
      )
    ).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await register(page, `calendar-other-${info.project.name}@example.invalid`);
  expect((await page.request.get(api + "?start=2027-01-03")).status()).toBe(
    404,
  );
  expect(
    (
      await page.request.patch(api, { headers, data: JSON.parse(body) })
    ).status(),
  ).toBe(404);
  await page.goto(calendar + "?start=2027-01-03");
  await expect(
    page.getByRole("heading", { name: "Property unavailable" }),
  ).toBeVisible();
});

test("owner saves private descriptions, addresses and facilities with safe retry and stale-edit protection", async ({
  page,
}, info) => {
  await register(page, `information-${info.project.name}@example.invalid`);
  const headers = {
    Origin: "http://127.0.0.1:8787",
    "Idempotency-Key": "information-property",
  };
  const response = await page.request.post("/api/owner/properties", {
    headers,
    data: { ...fields, ownerName: "Local Owner" },
  });
  expect(response.status()).toBe(201);
  const property = await response.json();
  const base = `/owner/properties/${property.id}`,
    api = "/api" + base + "/information";
  const before = await (await page.request.get("/api" + base)).json();
  expect((await (await page.request.get(api)).json()).revision).toBeNull();
  await page.goto(base);
  await page.getByRole("link", { name: "Information", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Property information", exact: true }),
  ).toBeVisible();
  const description = "ស្នាក់នៅជិតទន្លេ\nA quiet place to stay.";
  const address = "ផ្លូវភូមិ\nKampot";
  await assertFormHydration(page, "Property description", "Save property information");
  await page
    .getByLabel("Property description", { exact: true })
    .fill(description);
  await page.getByLabel(/Property address/).fill(address);
  await page
    .getByLabel("Facilities — one per line", { exact: true })
    .fill("Parking\n Wi-Fi in common areas \n");
  let key = "",
    body = "",
    retryKey = "",
    retryBody = "";
  await page.route(
    "**" + new URL(api, "http://127.0.0.1:8787").pathname,
    async (route) => {
      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }
      key = route.request().headers()["idempotency-key"];
      body = route.request().postData() ?? "";
      expect((await route.fetch()).status()).toBe(200);
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Save property information", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same save" }),
  ).toBeVisible();
  await expect(page.getByLabel(/Property address/)).toBeDisabled();
  await page.route(
    "**" + api,
    async (route) => {
      retryKey = route.request().headers()["idempotency-key"];
      retryBody = route.request().postData() ?? "";
      await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Retry same save" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Property information saved.",
  );
  await expect(page.getByLabel(/Property address/)).toBeEnabled();
  expect(retryKey).toBe(key);
  expect(retryBody).toBe(body);
  let saved = await page.request.get(api);
  expect(saved.status()).toBe(200);
  expect(saved.headers()["cache-control"]).toContain("no-store");
  expect(await saved.json()).toEqual({
    description,
    address,
    facilities: ["Parking", "Wi-Fi in common areas"],
    revision: 1,
  });
  expect(await (await page.request.get("/api" + base)).json()).toEqual(before);
  const url = page.url(),
    stale = await page.context().newPage();
  await stale.goto(url);
  await page.getByLabel(/Property address/).fill("River lane, Kampot");
  await page
    .getByRole("button", { name: "Save property information", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Property information saved.",
  );
  await expect(page.getByLabel(/Property address/)).toBeEnabled();
  await stale
    .getByLabel("Property description", { exact: true })
    .fill("Stale description");
  await stale
    .getByRole("button", { name: "Save property information", exact: true })
    .click();
  await expect(stale.locator("main").getByRole("alert")).toContainText(
    "changed since you opened it",
  );
  await stale
    .getByRole("button", { name: "Reload latest information" })
    .click();
  await expect(stale.getByLabel(/Property address/)).toHaveValue(
    "River lane, Kampot",
  );
  await expect(
    stale.getByLabel("Property description", { exact: true }),
  ).toHaveValue(description);
  await stale.close();
  await page.reload();
  await expect(page.getByLabel(/Property address/)).toHaveValue(
    "River lane, Kampot",
  );
  await expect(
    page.getByLabel("Facilities — one per line", { exact: true }),
  ).toHaveValue("Parking\nWi-Fi in common areas");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `/tmp/roc-information/${info.project.name}-information.png`,
    fullPage: true,
  });
  await page
    .getByLabel("Facilities — one per line", { exact: true })
    .fill("Parking\nParking");
  await page
    .getByRole("button", { name: "Save property information", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "different facilities",
  );
  await expect(page.getByRole("link", { name: "Sign in again" })).toHaveCount(
    0,
  );
  expect((await (await page.request.get(api)).json()).revision).toBe(2);
  expect(
    (
      await page.request.patch(api, {
        headers: { ...headers, Origin: "https://untrusted.example.invalid" },
        data: { description, address, facilities: [], revision: 2 },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch(api, {
        headers,
        data: {
          description,
          address,
          facilities: [],
          revision: 2,
          publication: "published",
        },
      })
    ).status(),
  ).toBe(422);
  const second = await page.request.post("/api/owner/properties", {
    headers: { ...headers, "Idempotency-Key": "information-second" },
    data: { ...fields, ownerName: "Local Owner" },
  });
  const secondProperty = await second.json();
  expect(
    (
      await (
        await page.request.get(
          `/api/owner/properties/${secondProperty.id}/information`,
        )
      ).json()
    ).address,
  ).toBe("");
  await page.getByLabel("Property description", { exact: true }).fill("");
  await page.getByLabel(/Property address/).fill("");
  await page.getByLabel("Facilities — one per line", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Save property information", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Property information saved.",
  );
  await expect(page.getByLabel(/Property address/)).toBeEnabled();
  expect(await (await page.request.get(api)).json()).toEqual({
    description: "",
    address: "",
    facilities: [],
    revision: 3,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await register(
    page,
    `information-other-${info.project.name}@example.invalid`,
  );
  expect((await page.request.get(api)).status()).toBe(404);
  expect(
    (
      await page.request.patch(api, { headers, data: JSON.parse(body) })
    ).status(),
  ).toBe(404);
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Property unavailable" }),
  ).toBeVisible();
});

test("owner saves private location/contact/arrival details with same-attempt recovery and stale-tab protection", async ({ page }, info) => {
  await register(page, "logistics-" + info.project.name + "@example.invalid");
  const headers = { Origin: "http://127.0.0.1:8787", "Idempotency-Key": "logistics-property" };
  const created = await page.request.post("/api/owner/properties", {
    headers, data: { ...fields, ownerName: "Local Owner" },
  });
  expect(created.status()).toBe(201);
  const property = await created.json();
  const base = "/owner/properties/" + property.id, api = "/api" + base + "/logistics";
  const originalProperty = await (await page.request.get("/api" + base)).json();
  expect((await (await page.request.get(api)).json()).revision).toBeNull();
  await page.goto(base);
  await page.getByRole("link", { name: "Location & contact", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Location & contact", exact: true })).toBeVisible();
  await assertFormHydration(page, "Latitude", "Save location and contact");
  await page.getByLabel("Latitude", { exact: true }).fill("10.606");
  await page.getByRole("button", { name: "Save location and contact", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Enter both valid coordinates");
  await page.getByLabel("Longitude", { exact: true }).fill("104.181");
  await page.getByLabel("Contact name", { exact: true }).fill("Reception");
  await page.getByLabel("Contact phone", { exact: true }).fill("+855 12 345 678");
  await page.getByLabel("Contact email", { exact: true }).fill("reception@example.invalid");
  await page.getByLabel("Directions and arrival notes", { exact: true }).fill("ផ្លូវភូមិ\nTurn left at the bridge.");
  let firstKey = "", firstBody = "", retryKey = "", retryBody = "";
  await page.route("**" + api, async route => {
    if (route.request().method() !== "PATCH") { await route.continue(); return; }
    firstKey = route.request().headers()["idempotency-key"];
    firstBody = route.request().postData() ?? "";
    expect((await route.fetch()).status()).toBe(200);
    await route.abort("failed");
  }, { times: 1 });
  await page.getByRole("button", { name: "Save location and contact", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry same save" })).toBeVisible();
  await expect(page.getByLabel("Latitude", { exact: true })).toBeDisabled();
  await page.route("**" + api, async route => {
    retryKey = route.request().headers()["idempotency-key"];
    retryBody = route.request().postData() ?? "";
    await route.continue();
  }, { times: 1 });
  await page.getByRole("button", { name: "Retry same save" }).click();
  await expect(page.getByRole("status")).toContainText("Location and contact details saved.");
  await expect(page.getByLabel("Latitude", { exact: true })).toBeEnabled();
  expect(retryKey).toBe(firstKey);
  expect(retryBody).toBe(firstBody);
  const read = await page.request.get(api);
  expect(read.headers()["cache-control"]).toContain("no-store");
  expect(await read.json()).toMatchObject({ latitude: 10.606, longitude: 104.181, contactName: "Reception", revision: 1 });
  expect(await (await page.request.get("/api" + base)).json()).toEqual(originalProperty);
  await page.reload();
  await expect(page.getByLabel("Directions and arrival notes", { exact: true })).toHaveValue("ផ្លូវភូមិ\nTurn left at the bridge.");
  const stale = await page.context().newPage();
  await stale.goto(page.url());
  await page.getByLabel("Contact phone", { exact: true }).fill("+855 12 000 111");
  await page.getByRole("button", { name: "Save location and contact", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Location and contact details saved.");
  await expect(page.getByLabel("Latitude", { exact: true })).toBeEnabled();
  await stale.getByLabel("Contact name", { exact: true }).fill("Stale reception");
  await stale.getByRole("button", { name: "Save location and contact", exact: true }).click();
  await expect(stale.locator("main").getByRole("alert")).toContainText("changed since you opened");
  await stale.getByRole("button", { name: "Reload latest details" }).click();
  await expect(stale.getByLabel("Contact phone", { exact: true })).toHaveValue("+855 12 000 111");
  await stale.close();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  for (const label of ["Latitude", "Longitude", "Contact name", "Contact phone", "Contact email", "Directions and arrival notes"]) {
    await page.getByLabel(label, { exact: true }).fill("");
  }
  await page.getByRole("button", { name: "Save location and contact", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Location and contact details saved.");
  await expect(page.getByLabel("Latitude", { exact: true })).toBeEnabled();
  const cleared = await (await page.request.get(api)).json();
  expect(cleared).toMatchObject({ latitude: null, longitude: null, contactPhone: "", arrivalInstructions: "", revision: 3 });
  expect((await page.request.patch(api, {
    headers: { ...headers, Origin: "https://untrusted.invalid" },
    data: { ...cleared, revision: 3 },
  })).status()).toBe(403);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await register(page, "logistics-other-" + info.project.name + "@example.invalid");
  expect((await page.request.get(api)).status()).toBe(404);
  expect((await page.request.patch(api, { headers, data: cleared })).status()).toBe(404);
  await page.goto(base + "/logistics");
  await expect(page.getByRole("heading", { name: "Property unavailable" })).toBeVisible();
});

test("sole pilot reviewer returns corrections and publishes only with configured terms; owner retries safely", async ({
  page,
  browser,
}, info) => {
  // This journey now prepares real listing content and a processed photo before
  // exercising both authenticated owner/reviewer workflows.
  test.setTimeout(90_000);
  const reviewerContext = await browser.newContext({
    ...devices[
      info.project.name.startsWith("mobile") ? "Pixel 7" : "Desktop Chrome"
    ],
    baseURL: "http://127.0.0.1:8787",
    extraHTTPHeaders: {
      "X-Test-Client": info.project.name + ":publication-reviewer",
    },
  });
  try {
    const reviewerPage = await reviewerContext.newPage();
    const ownerEmail = `review-owner-${info.project.name}@example.invalid`,
      reviewerEmail = `reviewer-${info.project.name}@example.invalid`;
    await register(reviewerPage, reviewerEmail);
    const session = (await (
      await reviewerPage.request.get("/api/auth/get-session")
    ).json()) as { user: { id: string } };
    const configure = async (termsVersion: string | null) =>
      expect(
        (
          await reviewerPage.request.post("/__test/pilot-reviewer", {
            data: { userId: session.user.id, termsVersion },
          })
        ).status(),
      ).toBe(200);
    await configure(null);
    await register(page, ownerEmail);
    const headers = {
      Origin: "http://127.0.0.1:8787",
      "Idempotency-Key": "review-browser-draft",
    };
    const created = await page.request.post("/api/owner/properties", {
      headers,
      data: { ...fields, ownerName: "Local Owner", nameEn: "Guest stay " + info.project.name },
    });
    expect(created.status()).toBe(201);
    const property = (await created.json()) as { id: string };
    const base = `/owner/properties/${property.id}`,
      api = "/api" + base + "/review";
    expect((await page.request.get("/api/property-reviews")).status()).toBe(
      404,
    );
    await page.goto(base + "/review");
    await expect(
      page.getByRole("heading", { name: "Publication review", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Publication checklist", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit saved draft", exact: true })).toBeDisabled();
    const incomplete = await page.request.post(api, {
      headers: { ...headers, "Idempotency-Key": "incomplete-direct" },
      data: { action: "submit", propertyRevision: 1 },
    });
    expect(incomplete.status()).toBe(422);
    expect(await incomplete.json()).toEqual({ error: "publication_incomplete" });
    await page.getByRole("link", { name: "Add a description", exact: true }).click();
    await page.getByLabel("Property description", { exact: true }).fill("ស្នាក់នៅជិតទន្លេ. A quiet riverside stay.");
    await page.getByLabel(/Property address/).fill("River lane, Kampot");
    await page.getByRole("button", { name: "Save property information", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    await page.goto(base + "/review");
    await page.getByRole("link", { name: "Add a contact method", exact: true }).click();
    await page.getByLabel("Contact email", { exact: true }).fill("reception@example.invalid");
    await page.getByRole("button", { name: "Save location and contact", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("saved");
    const roomsApi = "/api" + base + "/rooms";
    const roomResponse = await page.request.post(roomsApi, {
      headers: { ...headers, "Idempotency-Key": "review-room" },
      data: { name: "Garden room", adultCapacity: 2, childCapacity: 0, totalCapacity: 2 },
    });
    expect(roomResponse.status()).toBe(201);
    const room = await roomResponse.json() as { id: string };
    const night = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    expect((await page.request.patch(roomsApi + "/" + room.id + "/calendar", {
      headers: { ...headers, "Idempotency-Key": "review-calendar" },
      data: { roomRevision: 1, nights: [{ night, capacity: 1, blocked: 0, unitCents: 3500, inventoryRevision: null, rateRevision: null }] },
    })).status()).toBe(200);
    await page.goto(base + "/review");
    await page.getByRole("link", { name: "Add a property photo", exact: true }).click();
    await page.getByLabel("Photo file").setInputFiles({ name: "stay.jpg", mimeType: "image/jpeg", buffer: Buffer.from(photoFixtures.jpeg, "base64") });
    await page.getByRole("button", { name: "Upload photo", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("Photo saved privately.");
    // Slow script loading must not allow an acknowledgement that hydration then loses.
    let releaseScripts!: () => void;
    const scriptsReady = new Promise<void>(resolve => { releaseScripts = resolve; });
    const deferScripts = async (route: Route) => { await scriptsReady; await route.continue(); };
    const scriptPattern = "**/_next/static/**/*.js*";
    await page.route(scriptPattern, deferScripts);
    try {
      await page.goto(base + "/review", { waitUntil: "commit" });
      await expect(page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.", {exact:true})).toBeDisabled();
      await expect(page.getByRole("button", { name: "Submit saved draft", exact: true })).toBeDisabled();
    } finally {
      releaseScripts();
      // This is the only page route installed in this part of the journey.
      // Drain released handlers before cleanup so requests are not continued twice.
      await page.unrouteAll({ behavior: "wait" });
    }
    await page.waitForLoadState("load");
    await expect(page.getByRole("button", { name: "Submit saved draft", exact: true })).toBeDisabled();
    await expect(page.getByText("Guest listing preview", {exact:true})).toBeVisible();
    await page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.", {exact:true}).check();
    await expect(page.getByRole("button", { name: "Submit saved draft", exact: true })).toBeEnabled();
    const readiness = (await (await page.request.get(api)).json()).readiness;
    expect(readiness).toMatchObject({ ready: true, missing: [] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    // Another tab clears a required field after this page's readiness read.
    const logisticsApi = "/api" + base + "/logistics";
    const contact = await (await page.request.get(logisticsApi)).json();
    expect((await page.request.patch(logisticsApi, {
      headers: { ...headers, "Idempotency-Key": "review-stale-contact" },
      data: { ...contact, contactEmail: "" },
    })).status()).toBe(200);
    await page.getByRole("button", { name: "Submit saved draft", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("no longer meets the publication checklist");
    await page.getByRole("button", { name: "Reload latest status", exact: true }).click();
    await expect(page.getByRole("button", { name: "Submit saved draft", exact: true })).toBeDisabled();
    expect((await page.request.patch(logisticsApi, {
      headers: { ...headers, "Idempotency-Key": "review-restore-contact" },
      data: { ...contact, revision: 2 },
    })).status()).toBe(200);
    await page.reload();
    await page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.", {exact:true}).check();
    await expect(page.getByRole("button", { name: "Submit saved draft", exact: true })).toBeEnabled();
    const infoApi="/api"+base+"/information", savedInfo=await (await page.request.get(infoApi)).json();
    expect((await page.request.patch(infoApi,{headers:{...headers,"Idempotency-Key":"stale-public-preview"},data:{...savedInfo,description:savedInfo.description+"\nUpdated public description."}})).status()).toBe(200);
    await page.getByRole("button",{name:"Submit saved draft",exact:true}).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("latest guest listing preview");
    await page.getByRole("button",{name:"Reload latest status",exact:true}).click();
    await expect(page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.",{exact:true})).not.toBeChecked();
    await page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.",{exact:true}).check();
    let firstKey = "",
      firstBody = "",
      retryKey = "",
      retryBody = "";
    await page.route(
      "**" + api,
      async (route) => {
        firstKey = route.request().headers()["idempotency-key"];
        firstBody = route.request().postData() ?? "";
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      },
      { times: 1 },
    );
    await page
      .getByRole("button", { name: "Submit saved draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Retry same action" }),
    ).toBeVisible();
    await page.route(
      "**" + api,
      async (route) => {
        retryKey = route.request().headers()["idempotency-key"];
        retryBody = route.request().postData() ?? "";
        await route.continue();
      },
      { times: 1 },
    );
    await page.getByRole("button", { name: "Retry same action" }).click();
    await expect(
      page.getByRole("heading", { name: "Awaiting review" }),
    ).toBeVisible();
    expect(retryKey).toBe(firstKey);
    expect(retryBody).toBe(firstBody);
    await page.getByRole("button", { name: "Withdraw to edit" }).click();
    await page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.", {exact:true}).check();
    await expect(
      page.getByRole("button", { name: "Submit saved draft" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Submit saved draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Awaiting review" }),
    ).toBeVisible();
    const first = (
      (await (await page.request.get(api)).json()) as { latest: { id: string } }
    ).latest;
    await page.goto(base + "/logistics");
    await expect(
      page.getByLabel("Contact name", { exact: true }),
    ).toBeDisabled();
    await reviewerPage.goto("/owner");
    await reviewerPage
      .getByRole("link", { name: "Publication reviews", exact: true })
      .click();
    await expect(
      reviewerPage.getByRole("heading", {
        name: "Publication reviews",
        exact: true,
      }),
    ).toBeVisible();
    await reviewerPage.goto("/review/" + first.id);
    await expect(reviewerPage.getByRole("heading", { name: "Publication checklist", exact: true })).toBeVisible();
    await expect(reviewerPage.getByRole("link", { name: "Add a contact method", exact: true })).toHaveCount(0);
    await expect(
      reviewerPage.getByRole("button", { name: "Approve and publish" }),
    ).toBeDisabled();
    await reviewerPage
      .getByRole("button", { name: "Return for changes" })
      .click();
    await expect(reviewerPage.locator("main").getByRole("alert")).toContainText(
      "Add correction notes",
    );
    await reviewerPage
      .getByLabel("Correction notes or decision note")
      .fill("Please add arrival directions.");
    await reviewerPage
      .getByRole("button", { name: "Return for changes" })
      .click();
    await expect(reviewerPage).toHaveURL(/\/review$/);
    await page.goto(base + "/review");
    await expect(
      page.getByText("Please add arrival directions.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.", {exact:true}).check();
    await page.getByRole("button", { name: "Submit saved draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Awaiting review" }),
    ).toBeVisible();
    const next = (
      (await (await page.request.get(api)).json()) as { latest: { id: string } }
    ).latest;
    expect(next.id).not.toBe(first.id);
    await configure("browser-approved-v1");
    await reviewerPage.goto("/review/" + next.id);
    await expect(
      reviewerPage.getByRole("button", { name: "Approve and publish" }),
    ).toBeEnabled();
    expect(
      await reviewerPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await configure("browser-approved-v1");
    await reviewerPage
      .getByRole("button", { name: "Approve and publish" })
      .click();
    await expect(reviewerPage.locator("main").getByRole("alert")).toContainText("changed");
    await reviewerPage
      .getByRole("button", { name: "Reload latest status" })
      .click();
    await expect(
      reviewerPage.getByRole("button", { name: "Approve and publish" }),
    ).toBeEnabled();
    await reviewerPage
      .getByRole("button", { name: "Approve and publish" })
      .click();
    await expect(reviewerPage).toHaveURL(/\/review$/);
    await expect(
      reviewerPage.getByText("No pending submissions on this page.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(base + "/review");
    await expect(
      page.getByRole("heading", { name: "Published", exact: true }),
    ).toBeVisible();
    const result = (await (await page.request.get(api)).json()) as {
      publication: string;
      latest: { approvedTermsVersion: string };
    };
    expect(result.publication).toBe("published");
    expect(result.latest.approvedTermsVersion).toBe("browser-approved-v1");
    const visitorContext=await browser.newContext({...devices[info.project.name.startsWith("mobile")?"Pixel 7":"Desktop Chrome"],baseURL:"http://127.0.0.1:8787"});
    try {
      const visitor=await visitorContext.newPage();
      await visitor.goto("/stays");
      await visitor.getByLabel("Property name",{exact:true}).fill("Guest stay "+info.project.name);
      await visitor.getByLabel("Province",{exact:true}).fill("kampot");
      await visitor.getByRole("button",{name:"Search stays",exact:true}).click();
      await visitor.getByRole("link",{name:new RegExp("Guest stay "+info.project.name)}).click();
      await expect(visitor).toHaveURL(new RegExp("/stays/"+property.id+"$"));
      await expect(visitor.getByText("Updated public description.",{exact:false})).toBeVisible();
      const image=visitor.getByRole("img",{name:/Property photo 1 of/});
      await expect(image).toBeVisible();
      await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBeTruthy();
      const publicResponse=await visitor.request.get("/api/stays/"+property.id);
      expect(publicResponse.status()).toBe(200);expect(publicResponse.headers()["cache-control"]).toBe("no-store");expect(publicResponse.headers()["set-cookie"]).toBeUndefined();
      const publicData=await publicResponse.json();
      const html=await visitor.content();
      for(const excluded of ["River lane, Kampot","reception@example.invalid",'"address"','"contactEmail"','"arrivalInstructions"','"latitude"','"previewHash"',"private/properties/"]){expect(JSON.stringify(publicData)).not.toContain(excluded);expect(html).not.toContain(excluded);}
      expect(await visitor.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
      expect((await visitor.request.get("/api"+base+"/logistics")).status()).toBe(401);
      expect((await visitor.request.get("/api/stays/"+property.id+"/photos/"+publicData.photos[0].id+"/original")).status()).toBe(404);
      // Approved owner visibility controls reuse the real published/photo fixture.
      const listingApi="/api"+base+"/listing";
      const initialControls=await page.request.get(listingApi);
      expect(initialControls.status()).toBe(200);expect(initialControls.headers()["cache-control"]).toContain("no-store");
      expect((await visitor.request.get(listingApi)).status()).toBe(401);
      expect((await reviewerContext.request.get(listingApi)).status()).toBe(404);
      const original=await initialControls.json();
      await page.goto(base+"/review");
      const visibility=page.getByRole("region",{name:"Listing visibility",exact:true});
      const ack=visibility.getByRole("checkbox");
      await expect(visibility.getByRole("button",{name:"Pause listing",exact:true})).toBeDisabled();
      await ack.check();
      let visibilityKey="",visibilityBody="",retriedKey="",retriedBody="";
      await page.route("**"+listingApi,async route=>{
        visibilityKey=route.request().headers()["idempotency-key"];visibilityBody=route.request().postData()!;
        expect((await route.fetch()).status()).toBe(200);await route.abort("failed");
      },{times:1});
      await visibility.getByRole("button",{name:"Pause listing",exact:true}).click();
      await expect(visibility.getByRole("button",{name:"Retry same visibility action",exact:true})).toBeVisible();
      await expect(ack).toBeDisabled();
      await page.route("**"+listingApi,async route=>{
        retriedKey=route.request().headers()["idempotency-key"];retriedBody=route.request().postData()!;
        await route.continue();
      },{times:1});
      await visibility.getByRole("button",{name:"Retry same visibility action",exact:true}).click();
      await expect(visibility.getByRole("status")).toContainText("paused");
      expect(retriedKey).toBe(visibilityKey);expect(retriedBody).toBe(visibilityBody);
      expect((await visitor.request.get("/api/stays/"+property.id)).status()).toBe(404);
      expect((await visitor.request.get("/api/stays/"+property.id+"/photos/"+publicData.photos[0].id)).status()).toBe(404);
      const hidden=await(await visitor.request.get("/api/stays?q="+encodeURIComponent("Guest stay "+info.project.name))).json();
      expect(hidden.items.some((item:{id:string})=>item.id===property.id)).toBeFalsy();
      expect((await page.request.post(listingApi,{headers:{...headers,"Idempotency-Key":"stale-visibility"},
        data:{action:"pause",revision:original.revision,reviewId:original.reviewId,confirmed:true}})).status()).toBe(409);
      await page.reload();
      await expect(page.getByRole("heading",{name:"Paused",exact:true})).toBeVisible();
      await expect(visibility.getByRole("button",{name:"Resume listing",exact:true})).toBeDisabled();
      await ack.check();
      await visibility.getByRole("button",{name:"Resume listing",exact:true}).click();
      await expect(visibility.getByRole("status")).toContainText("published");
      expect((await visitor.request.get("/api/stays/"+property.id)).status()).toBe(200);
      await page.reload();
      await expect(page.getByRole("heading",{name:"Published",exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      // Offline correction cannot restore the prior approval; explicit new acknowledgement/review is required.
      await visibility.getByRole("checkbox").check();
      await visibility.getByRole("button",{name:"Pause listing",exact:true}).click();
      await expect(visibility.getByRole("status")).toContainText("paused");
      await page.reload();
      await expect(visibility.getByRole("button",{name:"Start corrections",exact:true})).toBeDisabled();
      await expect(visibility.getByText(/cannot resume the old approval/)).toBeVisible();
      await visibility.getByRole("checkbox").check();
      let reopenKey="",reopenBody="";
      await page.route("**"+listingApi,async route=>{
        reopenKey=route.request().headers()["idempotency-key"];reopenBody=route.request().postData()!;
        expect((await route.fetch()).status()).toBe(200);await route.abort("failed");
      },{times:1});
      await visibility.getByRole("button",{name:"Start corrections",exact:true}).click();
      await expect(visibility.getByRole("button",{name:"Retry same visibility action",exact:true})).toBeVisible();
      await page.route("**"+listingApi,async route=>{
        expect(route.request().headers()["idempotency-key"]).toBe(reopenKey);expect(route.request().postData()).toBe(reopenBody);
        await route.continue();
      },{times:1});
      await visibility.getByRole("button",{name:"Retry same visibility action",exact:true}).click();
      await expect(visibility.getByRole("status")).toContainText("draft");
      await page.reload();
      await expect(visibility.getByRole("button",{name:"Resume listing",exact:true})).toHaveCount(0);
      await expect(visibility.getByRole("link",{name:"Edit property draft",exact:true})).toBeVisible();
      expect((await visitor.request.get("/api/stays/"+property.id)).status()).toBe(404);
      await expect(page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.",{exact:true})).not.toBeChecked();
      await page.goto(base+"/information");
      await page.getByLabel("Property description",{exact:true}).fill("Corrected public description "+info.project.name);
      await page.getByRole("button",{name:"Save property information",exact:true}).click();
      await expect(page.getByRole("status")).toContainText("saved");
      await page.goto(base+"/logistics");
      await expect(page.getByRole("note")).toContainText("do not update contact or arrival details already saved for confirmed bookings");
      await page.getByLabel("Contact email",{exact:true}).fill("corrected-reception@example.invalid");
      await page.getByRole("button",{name:"Save location and contact",exact:true}).click();
      await expect(page.getByRole("status")).toContainText("saved");
      await page.goto(base+"/review");
      await expect(page.getByRole("button",{name:"Submit saved draft",exact:true})).toBeDisabled();
      await page.getByLabel("I understand these listing details and processed photos will be visible publicly after approval.",{exact:true}).check();
      await page.getByRole("button",{name:"Submit saved draft",exact:true}).click();
      await expect(page.getByRole("heading",{name:"Awaiting review",exact:true})).toBeVisible();
      const corrected=(await(await page.request.get(api)).json()).latest;
      expect(corrected.id).not.toBe(next.id);
      expect((await visitor.request.get("/api/stays/"+property.id)).status()).toBe(404);
      await reviewerPage.goto("/review/"+corrected.id);
      await expect(reviewerPage.getByText("Corrected public description "+info.project.name,{exact:true}).first()).toBeVisible();
      await reviewerPage.getByRole("button",{name:"Approve and publish",exact:true}).click();
      await expect(reviewerPage).toHaveURL(/\/review$/);
      const correctedPublic=await(await visitor.request.get("/api/stays/"+property.id)).json();
      expect(correctedPublic.description).toBe("Corrected public description "+info.project.name);
      expect(JSON.stringify(correctedPublic)).not.toContain("corrected-reception@example.invalid");
      expect((await page.request.post(listingApi,{headers:{...headers,"Idempotency-Key":reopenKey},data:JSON.parse(reopenBody)})).status()).toBe(200);
      expect((await visitor.request.get("/api/stays/"+property.id)).status()).toBe(200);
      await page.goto(base+"/review");
      await expect(page.getByRole("heading",{name:"Published",exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();


    } finally { await visitorContext.close(); }
  } finally {
    await reviewerContext.close();
  }
});

test("signed-out visitors can search, clear and recover from invalid or unavailable stay links",async({page},info)=>{
  await page.goto("/stays");
  await expect(page.getByRole("heading",{name:"Stays in Cambodia",exact:true})).toBeVisible();
  const query = "Missing-"+info.project.name+"-"+crypto.randomUUID();
  await page.getByLabel("Property name",{exact:true}).fill(query);
  await page.getByRole("button",{name:"Search stays",exact:true}).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === query);
  await expect(page.getByRole("heading",{name:"No stays found",exact:true}),
    "Empty search response: "+await page.locator("main").innerText()).toBeVisible();
  await page.getByRole("link",{name:"Clear search",exact:true}).click();
  await expect(page).toHaveURL(/\/stays$/);
  await page.goto("/stays?q="+"x".repeat(101));
  await expect(page.locator("main").getByRole("alert")).toContainText("Check the search details");
  await page.goto("/stays/not-a-public-property");
  await expect(page.getByRole("heading",{name:"Stay unavailable",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Explore other stays",exact:true}).click();
  await expect(page).toHaveURL(/\/stays$/);
});

test("a new account applies for owner access, an admin approves it, then drafts open", async ({ page, browser }, info) => {
  test.setTimeout(90_000);
  const business = "Applicant homestay " + info.project.name;
  await register(page, `applicant-${info.project.name}@example.invalid`, false);
  await expect(page.getByRole("heading", { name: "Apply to list your property", exact: true })).toBeVisible();
  await page.goto("/owner/properties/new");
  await expect(page.getByText("Creating a property draft needs approved owner access.")).toBeVisible();
  await page.goto("/owner/apply");
  await page.getByLabel("Business or owner name", { exact: true }).fill(business);
  await page.getByLabel("Phone number", { exact: true }).fill("+855 12 345 678");
  await page.getByLabel("Province of your property", { exact: true }).fill("Kampot");
  await page.getByRole("button", { name: "Send application", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Application received", exact: true })).toBeVisible();
  expect(
    (
      await page.request.post("/api/owner/properties", {
        headers: { Origin: "http://127.0.0.1:8787", "Idempotency-Key": "applicant-early-" + info.project.name },
        data: { ownerName: "Applicant", nameKm: "ផ្ទះ", nameEn: "Early", province: "Kampot", checkinTime: "14:00", checkoutTime: "11:00", policyText: "Quiet." },
      })
    ).status(),
  ).toBe(403);

  const adminContext = await browser.newContext({
    ...devices[info.project.name.startsWith("mobile") ? "Pixel 7" : "Desktop Chrome"],
    baseURL: "http://127.0.0.1:8787",
    extraHTTPHeaders: { "X-Test-Client": info.project.name + ":owner-admin" },
  });
  const admin = await adminContext.newPage();
  try {
    await register(admin, `owner-admin-${info.project.name}@example.invalid`, false);
    const session = (await (await admin.request.get("/api/auth/get-session")).json()) as { user: { id: string } };
    expect(
      (await admin.request.post("/__test/pilot-reviewer", { data: { userId: session.user.id, termsVersion: null } })).status(),
    ).toBe(200);
    await admin.goto("/admin/owners");
    await expect(admin.getByRole("heading", { name: "Owner applications", exact: true })).toBeVisible();
    const card = admin.getByRole("listitem").filter({ hasText: business });
    await card.getByLabel("Reason for " + business, { exact: true }).fill("Confirmed by phone.");
    await card.getByRole("button", { name: "Approve owner", exact: true }).click();
    await expect(admin.getByRole("listitem").filter({ hasText: business })).toHaveCount(0);
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  } finally {
    await adminContext.close();
  }

  await page.reload();
  await expect(page.getByText("Your owner access is approved.")).toBeVisible();
  await page.goto("/owner");
  await expect(page.getByRole("link", { name: "Create property draft", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
