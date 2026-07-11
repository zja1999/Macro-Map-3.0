import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Critical flow: search a food, log it, see it in the diary — then clean up.
// Logging from search is a multi-add flow: the page stays on /track/add with a
// running tally; "Done" (or direct navigation) lands on the diary.
test("log a food from search and see it on the tracker", async ({ page }) => {
  await login(page);

  await page.goto("/track/add?slot=snack");
  await page.fill('input[name="q"]', "Shrimp");
  await page.press('input[name="q"]', "Enter");

  const resultCard = page.locator("div.rounded-xl", { hasText: "Shrimp, cooked" }).first();
  await resultCard.getByRole("button", { name: "Log", exact: true }).click();

  // multi-add: still on the add page; the confirmation toast appears
  await expect(page.getByText(/Added Shrimp, cooked/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/track\/add/);

  // Done → diary shows the logged row
  await page.getByRole("link", { name: "Done" }).first().click();
  await expect(page).toHaveURL(/\/track\?date=/, { timeout: 15_000 });
  const entry = page.getByText("Shrimp, cooked").first();
  await expect(entry).toBeVisible();

  // clean up: remove the row so reruns stay deterministic
  const row = page.locator("li", { hasText: "Shrimp, cooked" }).first();
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("li", { hasText: "Shrimp, cooked" })).toHaveCount(0);
});

test("quick add logs a macro snapshot", async ({ page }) => {
  await login(page);

  await page.goto("/track/add?slot=snack&tab=quick");
  await page.fill('input[name="name"]', "E2E test snack");
  await page.fill('input[name="calories"]', "123");
  await page.fill('input[name="proteinG"]', "10");
  await page.getByRole("button", { name: "Log it" }).click();

  await expect(page).toHaveURL(/\/track\?date=/);
  await expect(page.getByText("E2E test snack")).toBeVisible();

  const row = page.locator("li", { hasText: "E2E test snack" }).first();
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("li", { hasText: "E2E test snack" })).toHaveCount(0);
});
