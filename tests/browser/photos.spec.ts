import { test, expect, type Page } from "@playwright/test";
import photos from "../photo-fixtures.json" with { type: "json" };
const origin = "http://127.0.0.1:8787",
  password = "LocalOnly-PhotoPassword-123!";
async function account(page: Page, email: string) {
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: origin },
    data: { name: "Photo owner", email, password },
  });
  expect(signup.ok()).toBeTruthy();
  const mail = await page.request.get(
    `/__test/mail?email=${encodeURIComponent(email)}&kind=verify`,
  );
  expect(mail.ok()).toBeTruthy();
  await page.goto((await mail.json()).url);
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/owner$/);
}
async function property(page: Page, key: string) {
  const response = await page.request.post("/api/owner/properties", {
    headers: { Origin: origin, "Idempotency-Key": key },
    data: {
      ownerName: "Photo owner",
      nameKm: "Photo draft",
      nameEn: "Photo house",
      province: "Kampot",
      checkinTime: "14:00",
      checkoutTime: "11:00",
      policyText: "Quiet hours.",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}
test("owner uploads, retries a lost response, reorders, handles stale tabs and removes private photos", async ({
  page,
  browser,
  request,
}, info) => {
  await page
    .context()
    .setExtraHTTPHeaders({ "X-Test-Client": "photos-" + info.project.name });
  await account(page, `photos-${info.project.name}@example.invalid`);
  const id = await property(page, "photo-property"),
    base = `/api/owner/properties/${id}/photos`;
  await page.goto(`/owner/properties/${id}/photos`);
  await expect(
    page.getByText("No photos yet.", { exact: false }),
  ).toBeVisible();
  let uploadId = "";
  await page.route(
    "**/api/owner/properties/*/photos/*",
    async (route) => {
      if (route.request().method() !== "PUT") {
        await route.continue();
        return;
      }
      uploadId = route.request().url().split("/").at(-1)!;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort("failed");
    },
    { times: 1 },
  );
  const file = {
    name: "property.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(photos.jpeg, "base64"),
  };
  await page.getByLabel("Photo file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same action" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry same action" }).click();
  await expect(page.getByRole("status")).toHaveText("Photo saved privately.");
  const image = page.getByRole("img", {
    name: "Property photo 1",
    exact: true,
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBeTruthy();
  const preview = await page.request.get(`${base}/${uploadId}`);
  expect(preview.status()).toBe(200);
  expect(preview.headers()["cache-control"]).toContain("no-store");
  expect(preview.headers()["content-type"]).toBe("image/jpeg");
  expect(preview.headers()["x-content-type-options"]).toBe("nosniff");
  expect((await request.get(origin + base + "/" + uploadId)).status()).toBe(
    401,
  );
  expect(
    (
      await page.request.put(`${base}/${uploadId}`, {
        headers: {
          Origin: "https://untrusted.example.invalid",
          "Content-Type": "image/jpeg",
        },
        data: file.buffer,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.put(`${base}/${uploadId}`, {
        headers: { Origin: origin, "Content-Type": "image/png" },
        data: file.buffer,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.put(`${base}/${uploadId}`, {
        headers: { Origin: origin, "Content-Type": "image/jpeg" },
        data: Buffer.concat([file.buffer, Buffer.from([0])]),
      })
    ).status(),
  ).toBe(413);
  const otherId = await property(page, "second-property");
  expect(
    (
      await page.request.get(
        `/api/owner/properties/${otherId}/photos/${uploadId}`,
      )
    ).status(),
  ).toBe(404);
  const stale = await page.context().newPage();
  await stale.goto(`/owner/properties/${id}/photos`);
  await page.getByLabel("Photo file").setInputFiles(file);
  await page.getByRole("button", { name: "Upload photo", exact: true }).click();
  await expect(page.getByRole("img")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Move photo 1 later", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Photo changes saved.");
  await expect(
    page.getByRole("img", { name: "Property photo 2", exact: true }),
  ).toHaveAttribute("src", `${base}/${uploadId}`);
  await stale
    .getByRole("button", { name: "Remove photo 1", exact: true })
    .click();
  await expect(stale.getByRole("alert")).toContainText(
    "changed in another tab",
  );
  await stale.close();
  await page
    .getByRole("button", { name: "Remove photo 2", exact: true })
    .click();
  await expect(page.getByRole("img")).toHaveCount(1);
  expect((await page.request.get(`${base}/${uploadId}`)).status()).toBe(404);
  await page.reload();
  await expect(page.getByRole("img")).toHaveCount(1);
  const anotherContext = await browser.newContext();
  try {
    await anotherContext.setExtraHTTPHeaders({
      "X-Test-Client": "photos-other-" + info.project.name,
    });
    const other = await anotherContext.newPage();
    await account(other, `photos-other-${info.project.name}@example.invalid`);
    expect((await other.request.get(origin + base)).status()).toBe(404);
    expect(
      (await other.request.get(origin + base + "/" + uploadId)).status(),
    ).toBe(404);
  } finally {
    await anotherContext.close();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
