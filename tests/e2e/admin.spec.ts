import { expect, test } from "@playwright/test";

const WIDTHS = [360, 768, 1280];
const PAGES = ["/mn/admin", "/en/admin", "/mn/admin?state=empty", "/mn/admin/kit"];

for (const width of WIDTHS) {
  for (const path of PAGES) {
    test(`no horizontal page scroll at ${width}px on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await page.locator("main h1").waitFor();
      const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(docWidth).toBeLessThanOrEqual(width);
    });
  }
}

test("error state shows a recovery action", async ({ page }) => {
  await page.goto("/en/admin?state=error");
  // Next also renders a role="alert" route announcer, so scope to ours.
  await expect(page.getByRole("alert").filter({ hasText: "The dashboard didn’t load" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("theme choice persists across reloads", async ({ page }) => {
  await page.goto("/en/admin");
  // Users click the visible segment (the label); the radio itself is visually hidden.
  await page.locator('label[title="Dark"]').click();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await page.reload();
  await expect(page.locator(".ops")).toHaveAttribute("data-theme", "dark");
});

test("admin pages are not indexed", async ({ page }) => {
  await page.goto("/en/admin");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("bilingual inputs line up side by side at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en/admin/kit");
  const mn = await page.locator('input[name="title.mn"]').boundingBox();
  const en = await page.locator('input[name="title.en"]').boundingBox();
  expect(mn && en && Math.abs(mn.y - en.y)).toBeLessThanOrEqual(1);
});
