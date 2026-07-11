import { test, expect } from "@playwright/test";
import { DEMO, login } from "./helpers";

const FORBIDDEN_EXPORT_KEYS = [
  "passwordHash",
  "tokenHash",
  "identifierHash",
  "accessTokenCiphertext",
  "refreshTokenCiphertext",
  "lastSyncCursor",
  "deviceToken",
  "storageKey",
  "gpxStorageKey",
  "errorMessage",
];

test("privacy policy and export authentication boundary are public/private respectively", async ({ page, request }) => {
  await page.goto("/privacy");
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByRole("heading", { name: "Your data should work for you." })).toBeVisible();
  await expect(page.getByText("We do not sell personal information")).toBeVisible();

  const response = await request.get("/api/account/export");
  expect(response.status()).toBe(401);
  expect(response.headers()["content-disposition"]).toBeUndefined();
});

test("ordinary users cannot enter moderator or admin pages", async ({ page }) => {
  await login(page);

  await page.goto("/admin");
  await expect(page).toHaveURL("/");

  await page.goto("/admin/users");
  await expect(page).toHaveURL("/");
});

test("authenticated export contains this account and no secret fields", async ({ page }) => {
  await login(page);

  const response = await page.request.get("/api/account/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-disposition"]).toMatch(/^attachment; filename="macroverse-/);

  const body = await response.json();
  expect(body.format).toBe("macroverse-account-export");
  expect(body.account.email).toBe(DEMO.email);
  expect(body.profile).toBeTruthy();

  const serialized = JSON.stringify(body);
  for (const key of FORBIDDEN_EXPORT_KEYS) expect(serialized).not.toContain(`"${key}"`);
  expect(serialized).not.toContain("maria@macromap.app");
  expect(serialized).not.toContain("admin@macromap.app");
});
