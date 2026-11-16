import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { statSync } from "node:fs";
import { signInAs } from "./helpers/as";

const A4_CONTENT_PX = Math.ceil((186 / 25.4) * 96) + 2; // 186 mm of printable width (210 mm − 2 × 12 mm margins)
const ready = async (page: Page) => { await page.locator("main h1").waitFor(); await page.getByRole("figure").first().waitFor(); await page.waitForLoadState("networkidle"); };

/** The completed seed event "Pitch Night · Autumn": its id comes from the events list. */
async function pitchNightId(page: Page): Promise<string> {
  await page.goto("/en/admin/events");
  const href = await page.locator('a[href*="/admin/events/"]', { hasText: "Pitch Night" }).first().getAttribute("href");
  const id = href?.split("/admin/events/")[1]?.split(/[/?]/)[0];
  if (!id) throw new Error("seed event pitch-night-autumn not found");
  return id;
}
const noHydrationErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text().slice(0, 200)); });
  return errors;
};
const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();

test.describe("event report", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  test("a completed event shows every section, with a Report tab on the event", async ({ page }) => {
    const id = await pitchNightId(page);
    await page.goto(`/en/admin/events/${id}`);
    await page.locator("main h1").waitFor();
    await expect(page.getByRole("navigation", { name: /Event sections|sections/i }).getByRole("link", { name: "Report" })).toBeVisible();

    await page.goto(`/en/admin/events/${id}/report`);
    await ready(page);
    for (const h of ["At a glance", "Who came", "Feedback"]) await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    for (const k of ["Registered", "Going", "Attended", "Show rate", "Average rating", "NPS", "Response rate"]) await expect(page.locator("main li p", { hasText: new RegExp(`^${k}$`) }).first()).toBeVisible();
    for (const chart of ["From registration to attendance", "Registrations per day", "Attendees by school", "Attendees by major track", "New and returning", "Rating distribution", "NPS: would you recommend it?"]) {
      await expect(page.getByRole("figure", { name: chart })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "What went well" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What to improve" })).toBeVisible();
    await expect(page.getByText(/Generated .* UTC\+8/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await expect(page.getByText("Choose “Save as PDF” in the print window.")).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|Infinity|undefined/);
  });

  test("an event that is not completed shows a short note and the way to Analytics (no Report tab)", async ({ page }) => {
    await page.goto("/en/admin/events");
    const href = await page.locator('a[href*="/admin/events/"]', { hasText: "Knowledge Day" }).first().getAttribute("href");
    await page.goto(`${href}`);
    await page.locator("main h1").waitFor();
    await expect(page.getByRole("link", { name: "Report", exact: true })).toHaveCount(0);
    await page.goto(`${href}/report`);
    await page.locator("main h1").waitFor();
    await expect(page.getByText("The report is ready once the event is completed")).toBeVisible();
    await expect(page.getByRole("link", { name: /Open analytics/ })).toHaveAttribute("href", /\/analytics$/);
  });

  test("print media: app chrome and buttons are hidden, the report fits an A4 page and the header repeats", async ({ page }) => {
    const id = await pitchNightId(page);
    await page.goto(`/en/admin/events/${id}/report`);
    await ready(page);
    await page.emulateMedia({ media: "print" });
    const info = await page.evaluate(() => {
      const shown = (el: Element | null) => !!el && getComputedStyle(el).display !== "none";
      const root = document.querySelector<HTMLElement>("[data-report-root]")!;
      const figs = [...root.querySelectorAll("figure")];
      return {
        aside: shown(document.querySelector(".ops-canvas > aside")),
        topbar: shown(document.querySelector(".ops-canvas > div > header")),
        stage: shown(document.querySelector("[data-stage]")),
        toolbar: shown(root.querySelector("[data-noprint]")),
        anyButton: [...root.querySelectorAll("button")].some(shown),
        rootWidth: root.getBoundingClientRect().width,
        figWidths: figs.map((f) => Math.round(f.getBoundingClientRect().width)),
        figCount: figs.length,
        header: getComputedStyle(root.querySelector(".report-running")!).display,
        breakInside: figs.every((f) => getComputedStyle(f).breakInside === "avoid"),
        sectionBreak: getComputedStyle(root.querySelectorAll(".report-section")[1]).breakBefore,
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(info).toMatchObject({ aside: false, topbar: false, stage: false, toolbar: false, anyButton: false, header: "table-header-group", breakInside: true, sectionBreak: "page" });
    expect(info.rootWidth).toBeLessThanOrEqual(A4_CONTENT_PX);
    expect(info.figCount).toBeGreaterThanOrEqual(6);
    for (const w of info.figWidths) expect(w).toBeLessThanOrEqual(A4_CONTENT_PX);
    expect(info.bodyBg).toBe("rgb(255, 255, 255)");
    await page.emulateMedia({ media: "screen" });
  });

  test("Download image saves a PNG named after the report and the chart", async ({ page }) => {
    const id = await pitchNightId(page);
    await page.goto(`/en/admin/events/${id}/report`);
    await ready(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download image: From registration to attendance" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("pitch-night-autumn-funnel.png");
    const path = await download.path();
    expect(statSync(path).size).toBeGreaterThan(5_000);
  });

  test("Download all images saves one PNG per chart, in turn", async ({ page }) => {
    test.setTimeout(120_000);
    const id = await pitchNightId(page);
    await page.goto(`/en/admin/events/${id}/report`);
    await ready(page);
    const buttons = await page.locator("[data-report-root] [data-chart-image]").count();
    expect(buttons).toBeGreaterThanOrEqual(6);
    const names: string[] = [];
    page.on("download", (d) => names.push(d.suggestedFilename()));
    await page.getByRole("button", { name: "Download all images" }).click();
    await expect.poll(() => names.length, { timeout: 60_000 }).toBe(buttons);
    expect(names.every((n) => /^pitch-night-autumn-[a-z-]+\.png$/.test(n))).toBe(true);
    expect(new Set(names).size).toBe(buttons);
    await expect(page.getByText(`${buttons} images downloaded`)).toBeVisible();
  });

  test("an image that cannot be made shows an error toast, not a silent failure", async ({ page }) => {
    const id = await pitchNightId(page);
    await page.goto(`/en/admin/events/${id}/report`);
    await ready(page);
    await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = (cb) => cb(null); });
    await page.getByRole("button", { name: "Download image: Registrations per day" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Could not create the image" })).toBeVisible();
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no WCAG 2.2 A/AA violations on the event report (${scheme})`, async ({ page }) => {
      const id = await pitchNightId(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/en/admin/events/${id}/report`);
      await ready(page);
      expect((await axe(page)).violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }

  test("Mongolian at 390 px: no horizontal scroll, no hydration errors", async ({ page }) => {
    const errors = noHydrationErrors(page);
    const id = await pitchNightId(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/mn/admin/events/${id}/report`);
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole("button", { name: "PDF татах" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("period report", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  test("defaults to this semester, takes the range from the URL and falls back on bad input", async ({ page }) => {
    await page.goto("/en/admin/reports");
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Date range: This semester/ })).toBeVisible();
    for (const h of ["At a glance", "Events", "Semester comparison", "People and polls"]) await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    for (const k of ["Events", "Unique attendees", "Show rate", "New members", "Average rating", "NPS"]) await expect(page.locator("main li p", { hasText: new RegExp(`^${k}$`) }).first()).toBeVisible();

    await page.goto("/en/admin/reports?from=2025-09-01&to=2026-08-31");
    await ready(page);
    await expect(page.getByRole("heading", { level: 2, name: /Sep 1, 2025 – Aug 31, 2026/ })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|Infinity|undefined/);

    await page.goto("/en/admin/reports?from=2001-03-01&to=2001-03-01");
    await ready(page);
    await expect(page.getByText("No completed events in this range")).toBeVisible();
    await expect(page.getByText("No closed polls in this range")).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|Infinity|undefined/);

    await page.goto("/en/admin/reports?from=2026-02-30&to=nope");
    await ready(page);
    await expect(page.getByRole("button", { name: /Date range: This semester/ })).toBeVisible();
  });

  test("each event links to its report, and image export is named after the range", async ({ page }) => {
    await page.goto("/en/admin/reports?from=2025-09-01&to=2026-12-31");
    await ready(page);
    const link = page.getByRole("link", { name: /^Report: / }).first();
    await expect(link).toHaveAttribute("href", /\/en\/admin\/events\/[^/]+\/report$/);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download image: Registrations per day" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("2025-09-01_2026-12-31-registrations.png");
  });

  test("print media hides the chrome here too", async ({ page }) => {
    await page.goto("/en/admin/reports");
    await ready(page);
    await page.emulateMedia({ media: "print" });
    const r = await page.evaluate(() => ({
      aside: getComputedStyle(document.querySelector(".ops-canvas > aside")!).display,
      stage: getComputedStyle(document.querySelector("[data-stage]")!).display,
      width: document.querySelector("[data-report-root]")!.getBoundingClientRect().width,
    }));
    expect(r.aside).toBe("none");
    expect(r.stage).toBe("none");
    expect(r.width).toBeLessThanOrEqual(A4_CONTENT_PX);
    await page.emulateMedia({ media: "screen" });
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no WCAG 2.2 A/AA violations on the period report (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/en/admin/reports?from=2025-09-01&to=2026-12-31");
      await ready(page);
      expect((await axe(page)).violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }

  test("Mongolian at 390 px: no horizontal scroll, no hydration errors", async ({ page }) => {
    const errors = noHydrationErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mn/admin/reports?from=2025-09-01&to=2026-12-31");
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    expect(errors).toEqual([]);
  });
});

test.describe("who may open the reports", () => {
  for (const handle of ["anuujin", "temuulen"]) {
    test(`${handle} gets the ordinary 404 on both reports`, async ({ page }) => {
      await signInAs(page, handle);
      expect((await page.goto("/en/admin/reports"))?.status()).toBe(404);
      expect((await page.goto("/en/admin/events/e_1/report"))?.status()).toBe(404);
      expect(await page.locator("body").innerText()).not.toMatch(/Unique attendees|Attendees by school/);
    });
  }
  test("a signed-out visitor is sent to sign-in and back", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/admin/reports");
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Fadmin%2Freports/);
  });
  test("an unknown event id is a real 404", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    expect((await page.goto("/en/admin/events/nope-not-real/report"))?.status()).toBe(404);
  });
});
