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
