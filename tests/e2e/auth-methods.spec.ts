import { expect, test } from "@playwright/test";

const emailPasswordEnabled = process.env.AUTH_EMAIL_PASSWORD_ENABLED?.trim().toLowerCase() === "true";
const next = "/macrotray-connect?code=auth-test";
const encodedNext = encodeURIComponent(next);

test.describe("Google-only authentication", () => {
  test.skip(emailPasswordEnabled, "Run with AUTH_EMAIL_PASSWORD_ENABLED=false");

  test("shows Google as the only login and registration entry point", async ({ page }) => {
    await page.goto(`/login?next=${encodedNext}`);

    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      `/api/auth/google/start?next=${encodedNext}`,
    );
    await expect(page.locator('input[name="email"]')).toHaveCount(0);
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /forgot your password/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /create an account/i })).toHaveCount(0);

    await page.goto(`/register?next=${encodedNext}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodedNext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      `/api/auth/google/start?next=${encodedNext}`,
    );
  });

  test("hides recovery, reset, and resend controls", async ({ page }) => {
    for (const path of ["/forgot-password", "/reset-password?token=test-token", "/verify-email/sent?email=user@example.com"]) {
      await page.goto(path);
      await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
      await expect(page.locator("input")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /send|reset|resend/i })).toHaveCount(0);
    }
  });
});

test.describe("email/password-enabled authentication", () => {
  test.skip(!emailPasswordEnabled, "Run with AUTH_EMAIL_PASSWORD_ENABLED=true");

  test("retains login, registration, verification, and recovery controls", async ({ page }) => {
    await page.goto(`/login?next=${encodedNext}`);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot your password/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
      "href",
      `/api/auth/google/start?next=${encodedNext}`,
    );

    await page.goto(`/register?next=${encodedNext}`);
    await expect(page.locator('input[name="displayName"]')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    await page.goto("/forgot-password");
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();

    await page.goto("/verify-email/sent?email=user@example.com");
    await expect(page.getByRole("button", { name: "Resend verification" })).toBeVisible();

    await page.goto("/reset-password?token=test-token");
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });
});

test("renders allow-listed Google failures and preserves a safe retry destination", async ({ page }) => {
  await page.goto(`/login?error=google_state_invalid&next=${encodedNext}`);

  await expect(page.locator('main [role="alert"]')).toContainText("Start Google sign-in again");
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    `/api/auth/google/start?next=${encodedNext}`,
  );

  await page.goto("/login?error=provider_secret%3Ddo-not-render");
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  await expect(page.getByText("do-not-render")).toHaveCount(0);
});
