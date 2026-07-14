import { expect, test } from "@playwright/test";

test("MacroTray creates a browser-only pairing approval link", async ({ page }) => {
  const pairingStarted = page.waitForResponse((response) => response.url().endsWith("/api/macrotray/pair/start"));
  await page.goto("/macrotray");
  await expect(page.getByRole("heading", { name: "Connect MacroTray" })).toBeVisible();
  expect((await pairingStarted).status()).toBe(200);

  const approval = page.getByRole("link", { name: /Open browser to connect/ });
  await expect(approval).toBeVisible({ timeout: 15_000 });
  const href = await approval.getAttribute("href");

  expect(href).toMatch(/^\/macrotray-connect\?code=[a-f0-9]{64}$/);
  expect(await approval.getAttribute("target")).toBeNull();
  expect(href).not.toContain("deviceCode");
  expect(href).not.toContain("mm_session");
});

test("pairing approval preserves only a relative sign-in continuation", async ({ page }) => {
  const code = "a".repeat(64);
  await page.goto(`/macrotray-connect?code=${code}`);

  const signInHref = await page.getByRole("link", { name: "Sign in" }).getAttribute("href");
  expect(signInHref).toBe(`/login?next=${encodeURIComponent(`/macrotray-connect?code=${code}`)}`);
});
