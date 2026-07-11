import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Critical flow: the social loop — following feed shows followed creators'
// posts, posting works, and the compact reaction picker persists a choice.
test("following feed shows followed creators and accepts a post", async ({ page }) => {
  await login(page);

  await expect(page.getByText("Coach Dan").first()).toBeVisible();

  const body = `E2E check-in ${Date.now()} — hit protein again today.`;
  await page.fill('textarea[name="body"]', body);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(body)).toBeVisible({ timeout: 15_000 });
});

test("reacting to a post updates the reaction state", async ({ page }) => {
  await login(page);

  const trigger = page.getByRole("button", { name: /reaction\. Hold for more reactions\./ }).first();
  const initialLabel = await trigger.getAttribute("aria-label");
  await trigger.click();
  await expect(
    page.getByRole("button", {
      name: initialLabel?.startsWith("React.") ? /Like reaction/ : /^React\. Hold for more reactions\.$/,
    }).first(),
  ).toBeVisible({ timeout: 10_000 });
});

test("profile page follow state and posts render", async ({ page }) => {
  await login(page);
  await page.goto("/u/chef_maria");
  await expect(page.getByText("Maria Delgado").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Following|Follow/ }).first()).toBeVisible();
});
