import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
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
async function register(page: Page, email: string) {
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
}
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
