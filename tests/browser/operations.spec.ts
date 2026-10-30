import { test, expect, type APIRequestContext } from "@playwright/test";
const origin = "http://127.0.0.1:8787";
async function account(request: APIRequestContext, email: string) {
  const password = "LocalOnly-Operations-Password-123!";
  const r = await request.post("/api/auth/sign-up/email", {headers: {Origin: origin},
    data: {name: "Operations owner", email, password}});
  expect(r.ok()).toBeTruthy();
  const mail = await (await request.get("/__test/mail?email=" + encodeURIComponent(email))).json();
  expect((await request.get(mail.url)).ok()).toBeTruthy();
  expect((await request.post("/api/auth/sign-in/email", {headers: {Origin: origin}, data: {email, password}})).ok()).toBeTruthy();
}
async function write(request: APIRequestContext, url: string, data: unknown, method: "post" | "patch" = "post") {
  const r = await request[method](url, {headers: {Origin: origin, "Idempotency-Key": crypto.randomUUID()}, data});
  expect(r.ok(), await r.text()).toBeTruthy(); return r.json();
}
async function setup(request: APIRequestContext) {
  const p = await write(request, "/api/owner/properties", {ownerName: "Operations owner",
    nameKm: "ផ្ទះសំណាក់", nameEn: "Operations stay", province: "Kampot",
    checkinTime: "14:00", checkoutTime: "11:00", policyText: "Quiet nights."});
  const room = await write(request, `/api/owner/properties/${p.id}/rooms`,
    {name: "Garden room", adultCapacity: 2, childCapacity: 1, totalCapacity: 3});
  const night = new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10);
  const checkout = new Date(Date.parse(night) + 86400000).toISOString().slice(0,10);
  await write(request, `/api/owner/properties/${p.id}/rooms/${room.id}/calendar`,
    {roomRevision: 1, nights: [{night, capacity: 2, blocked: 0, unitCents: 3500, inventoryRevision: null, rateRevision: null}]}, "patch");
  return {p, room, night, checkout};
}
test("owner manages configured nights with protected reservations, exact retry and stale-tab refusal", async ({page}, info) => {
  await page.context().setExtraHTTPHeaders({"X-Test-Client": "availability-" + info.project.name});
  await account(page.request, `availability-${info.project.name}@example.invalid`);
  const {p, room, night, checkout} = await setup(page.request);
  const url = `/owner/properties/${p.id}/availability/${room.id}?start=${night}`;
  await page.goto(`/owner/properties/${p.id}/availability`);
  await expect(page.getByRole("heading", {name: "Manage availability", exact: true})).toBeVisible();
  await page.goto(url);
  const card = page.getByRole("region", {name: "Availability for " + night});
  await expect(card.getByText("Reserved: 0", {exact: false})).toBeVisible();
  await card.getByLabel("Capacity", {exact: true}).fill("3");
  await card.getByLabel("Blocked units", {exact: true}).fill("1");
  let firstKey = "", firstBody = "", retryKey = "", retryBody = "";
  await page.route("**/api/inventory", async route => {
    firstKey = route.request().headers()["idempotency-key"];
    firstBody = route.request().postData()!;
    expect((await route.fetch()).status()).toBe(200); await route.abort("failed");
  }, {times: 1});
  await card.getByRole("button", {name: "Save night", exact: true}).click();
  await expect(card.getByRole("button", {name: "Retry same availability update", exact: true})).toBeVisible();
  await expect(card.getByLabel("Capacity", {exact: true})).toBeDisabled();
  await page.route("**/api/inventory", async route => {
    retryKey = route.request().headers()["idempotency-key"]; retryBody = route.request().postData()!;
    await route.continue();
  }, {times: 1});
  await card.getByRole("button", {name: "Retry same availability update", exact: true}).click();
  await expect(card.getByRole("status")).toContainText("Availability saved");
  expect(retryKey).toBe(firstKey); expect(retryBody).toBe(firstBody);
  await page.reload();
  await expect(card.getByLabel("Capacity", {exact: true})).toHaveValue("3");
  await expect(card.getByLabel("Blocked units", {exact: true})).toHaveValue("1");
  const api = `/api/owner/properties/${p.id}/rooms/${room.id}/calendar?start=${night}`;
  let current = (await (await page.request.get(api)).json()).nights[0];
  await write(page.request, "/api/inventory", {roomId: room.id, night, capacity: 4, blocked: 1, revision: current.inventoryRevision});
  await card.getByLabel("Capacity", {exact: true}).fill("5");
  await card.getByRole("button", {name: "Save night", exact: true}).click();
  await expect(card.getByRole("alert")).toContainText("Availability or your access changed");
  await expect(card.getByRole("button", {name: "Save night", exact: true})).toHaveCount(0);
  await page.reload();
  const selection = {propertyId: p.id, checkin: night, checkout, termsVersion: "unconfigured",
    lines: [{roomId: room.id, quantity: 1, adults: 2, children: 0}]};
  const preview = await write(page.request, "/api/external-reservations", {...selection, preview: true});
  await write(page.request, "/api/external-reservations", {...selection, quoteHash: preview.hash});
  await page.reload();
  await expect(card.getByText("Reserved: 1", {exact: false})).toBeVisible();
  await card.getByLabel("Capacity", {exact: true}).fill("1");
  await card.getByLabel("Blocked units", {exact: true}).fill("1");
  await card.getByRole("button", {name: "Save night", exact: true}).click();
  await expect(card.getByRole("alert")).toHaveText("Capacity must cover reserved and blocked units together.");
  current = (await (await page.request.get(api)).json()).nights[0];
  expect(current).toMatchObject({capacity: 4, blocked: 1, reserved: 1, unitCents: 3500});
  await expect(page.getByText("No inventory configured for this night.", {exact: true})).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.goto(url.replace(night, "2026-02-30"));
  await expect(page.getByText("Invalid date. Open the current week.", {exact: true})).toBeVisible();
  const other = await page.context().browser()!.newContext({baseURL: origin, extraHTTPHeaders: {"X-Test-Client": "availability-other-" + info.project.name}});
  try {
    await account(other.request, `availability-other-${info.project.name}@example.invalid`);
    const denied = await other.newPage();
    await denied.goto(url);
    await expect(denied.getByRole("heading", {name: "Property unavailable", exact: true})).toBeVisible();
    await expect(denied.getByRole("heading", {name: "Nightly availability", exact: true})).toHaveCount(0);
    await expect(denied.getByLabel("Capacity", {exact: true})).toHaveCount(0);
    expect((await other.request.get(api)).status()).toBe(404);
  } finally { await other.close(); }
});
