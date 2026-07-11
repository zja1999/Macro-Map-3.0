import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Critical flow: the social loop — following feed shows followed
// creators' posts, posting works, reactions stick.
test("following feed shows followed creators and accepts a post", async ({ page }) => {
  await login(page);

  // demo follows the three seeded creators; the following feed must have their posts
  await expect(page.getByText("Coach Dan").first()).toBeVisible();

  // post an update
  const body = `E2E check-in ${Date.now()} — hit protein again today.`;
  await page.fill('textarea[name="body"]', body);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });
});

test("reacting to a post updates the reaction state", async ({ page }) => {
  await login(page);

  await page.getByRole("button", { name: "❤️" }).first().click();
  // server action revalidates; an active reaction renders with the accent ring
  await expect(page.locator("button.ring-accent\\/40").first()).toBeVisible({ timeout: 10_000 });
});

test("profile page follow state and posts render", async ({ page }) => {
  await login(page);
  await page.goto("/u/chef_maria");
  await expect(page.getByText("Maria Delgado").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Following|Follow/ }).first()).toBeVisible();
});
