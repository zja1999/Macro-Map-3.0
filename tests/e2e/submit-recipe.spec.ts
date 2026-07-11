import { test, expect } from "@playwright/test";
import { login, CREATOR } from "./helpers";

// Critical flow: submit a recipe with linked ingredients and get
// machine-calculated macros + ingredient_calculated provenance.
test("submit a fully-linked recipe and land on its detail page", async ({ page }) => {
  await login(page, CREATOR);

  await page.goto("/recipes/new");
  const name = `E2E Chicken & Rice ${Date.now()}`;
  await page.fill('input[name="name"]', name);

  // link two ingredients to seeded foods (datalist matches by exact name)
  const ingredientInputs = page.locator('input[list="food-options"]');
  await ingredientInputs.first().fill("Chicken breast, cooked");
  await page.locator('input[placeholder="g"]').first().fill("300");

  await page.getByRole("button", { name: "+ Add ingredient" }).click();
  await ingredientInputs.nth(1).fill("White rice, cooked");
  await page.locator('input[placeholder="g"]').nth(1).fill("400");

  // live tally should flip to calculated once everything is linked
  await expect(page.getByText("Calculated per serving")).toBeVisible();

  await page.fill('textarea[name="instructions"]', "1. Cook the chicken.\n2. Serve over rice.");
  await page.getByRole("button", { name: "Publish recipe" }).click();

  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Calculated from ingredients")).toBeVisible();
});
