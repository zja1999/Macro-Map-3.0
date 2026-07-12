import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { CREATOR, DEMO, login } from "./helpers";

test("private multi-photo timeline, comparison, and authorization", async ({ page, request, context }) => {
  await login(page, DEMO);
  const today = new Date().toISOString().slice(0, 10);
  const earlier = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const image = await sharp({ create: { width: 80, height: 120, channels: 3, background: "#16a34a" } }).jpeg().toBuffer();

  await page.goto("/progress/photos");
  const input = page.locator('input[type="file"]');
  await input.setInputFiles([
    { name: "front.jpg", mimeType: "image/jpeg", buffer: image },
    { name: "side.jpg", mimeType: "image/jpeg", buffer: image },
  ]);
  await page.getByRole("button", { name: "Upload 2 photos" }).click();
  await expect(page.locator('img[alt^="Progress on"]')).toHaveCount(2);

  await page.locator('input[type="date"]').fill(earlier);
  await input.setInputFiles({ name: "earlier.jpg", mimeType: "image/jpeg", buffer: image });
  await page.getByRole("button", { name: "Upload 1 photo" }).click();
  await expect(page.getByRole("heading", { name: "Compare progress" })).toBeVisible();

  const photoUrl = await page.locator('img[alt^="Progress on"]').first().getAttribute("src");
  expect(photoUrl).toMatch(/^\/api\/progress\/photos\/[0-9a-f-]+$/);
  const photoId = photoUrl!.split("/").at(-1)!;

  await context.clearCookies();
  expect((await request.get(`/api/progress/photos/${photoId}`)).status()).toBe(401);
  await login(page, CREATOR);
  expect((await page.request.get(`/api/progress/photos/${photoId}`)).status()).toBe(404);
  expect((await page.request.get(`/api/progress/photos/${photoId}?download=1`)).status()).toBe(404);
  expect((await page.request.delete(`/api/progress/photos/${photoId}`)).status()).toBe(404);

  await context.clearCookies();
  await login(page, DEMO);
  expect((await page.request.delete(`/api/progress/photos/${photoId}`)).status()).toBe(204);
  expect((await page.request.get(`/api/progress/photos/${photoId}`)).status()).toBe(404);
});
