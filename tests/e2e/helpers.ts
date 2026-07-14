import { type Page, expect } from "@playwright/test";

export const DEMO = { username: "demo", email: "demo@macromap.app", password: "password123" };
export const CREATOR = { username: "chef_maria", email: "maria@macromap.app", password: "password123" };

export async function login(page: Page, user: { username: string; password: string } = DEMO) {
  await page.goto("/login");
  await page.fill('input[name="username"]', user.username);
  await page.fill('input[name="password"]', user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/", { timeout: 15_000 });
}
