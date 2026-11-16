import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.beforeEach(async ({ page }) => { await signInAs(page, "dev-admin"); });

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

test("non-staff get the ordinary 404 and signed-out visitors never see the backoffice", async ({ page }) => {
  for (const who of [null, "anuujin", "temuulen"]) {
    await signInAs(page, who);
    const res = await page.goto("/en/admin");
    await expect(page.getByText("coffee not found")).toBeVisible();
    expect(res?.status()).toBeLessThan(500);
    await expect(page.locator("main h1", { hasText: "Dashboard" })).toHaveCount(0);
  }
});

test("an organizer sees the dashboard with live demo data and the demo-data marker", async ({ page }) => {
  await signInAs(page, "dev-organizer");
  await page.goto("/en/admin");
  await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
  await expect(page.getByText("Demo data").first()).toBeVisible();
  await expect(page.getByText("Needs attention")).toBeVisible();
});

test("dashboard: needs-attention rows and event rows are links to where the work is done", async ({ page }) => {
  await page.goto("/en/admin");
  const apps = page.getByRole("link", { name: /hackathon applications? to review/ });
  await expect(apps).toHaveAttribute("href", "/en/admin/events?filter=applications");
  await expect(page.getByRole("link", { name: /emails? failed to send/ })).toHaveAttribute("href", "/en/admin/comms?status=failed");
  await apps.click();
  await expect(page.getByRole("button", { name: "Remove filter: Applications to review" })).toBeVisible();

  await page.goto("/en/admin");
  const event = page.getByRole("link", { name: /Knowledge Day: Building RAG Systems/ });
  await expect(event).toHaveAttribute("href", /\/en\/admin\/events\/e_\d+$/);
  await event.click();
  await expect(page.getByRole("heading", { level: 1, name: "Knowledge Day: Building RAG Systems" })).toBeVisible();
});

test("dashboard keeps no horizontal scroll with linked rows at 360px in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en/admin");
  await page.locator("main h1").waitFor();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
