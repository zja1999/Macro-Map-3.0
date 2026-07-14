import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const next = "/macrotray-connect?code=auth-test";
const encodedNext = encodeURIComponent(next);

test("signs a seeded account in by username", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL("/");
});

test("offers username/password and Google on login and registration", async ({ page }) => {
  await page.goto(`/login?next=${encodedNext}`);
  await expect(page.locator('input[name="username"]')).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    `/api/auth/google/start?purpose=sign_in&next=${encodedNext}`,
  );

  await page.goto(`/register?next=${encodedNext}`);
  await expect(page.locator('input[name="displayName"]')).toBeVisible();
  await expect(page.locator('input[name="username"]')).toBeVisible();
  await expect(page.locator('input[name="email"]')).toHaveCount(0);
  await expect(page.locator('input[name="password"]')).toHaveAttribute("minlength", "12");
  await expect(page.locator('input[name="passwordConfirmation"]')).toBeVisible();
});

test("uses linked Google instead of email delivery for recovery", async ({ page }) => {
  await page.goto("/forgot-password");
  await expect(page.getByRole("link", { name: "Recover with linked Google" })).toHaveAttribute(
    "href",
    "/api/auth/google/start?purpose=recover",
  );
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.getByText(/cannot create or link a new account/i)).toBeVisible();
});

test("retains legacy reset-token consumption without email initiation", async ({ page }) => {
  await page.goto("/reset-password?token=test-token");
  await expect(page.locator('input[name="password"]')).toHaveAttribute("minlength", "12");
  await expect(page.locator('input[name="passwordConfirmation"]')).toBeVisible();
});

test("renders allow-listed Google failures and preserves a safe retry destination", async ({ page }) => {
  await page.goto(`/login?error=google_state_invalid&next=${encodedNext}`);
  await expect(page.locator('main [role="alert"]')).toContainText("Start Google sign-in again");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    `/api/auth/google/start?purpose=sign_in&next=${encodedNext}`,
  );
  await page.goto("/login?error=provider_secret%3Ddo-not-render");
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  await expect(page.getByText("do-not-render")).toHaveCount(0);
});
