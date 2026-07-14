import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test("username targeting suggests prefix matches with profile context", async ({ page }) => {
  await login(page, { username: "coach_dan", password: "password123" });
  await page.goto("/groups/cutting-crew");

  const input = page.getByPlaceholder("Invite by username…");
  await input.fill("PR");

  const option = page.getByRole("option", { name: /Marcus \(Prep King\).*@prep_king/i });
  await expect(option).toBeVisible();
  await option.click();
  await expect(input).toHaveValue("prep_king");
});
