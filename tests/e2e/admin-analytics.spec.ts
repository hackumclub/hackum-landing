import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

const TABS = ["overview", "events", "members", "semesters"] as const;
const url = (tab: string) => `/en/admin/analytics${tab === "overview" ? "" : `?tab=${tab}`}`;
const ready = async (page: Page) => { await page.locator("main h1").waitFor(); await page.getByRole("figure").first().waitFor(); await page.waitForLoadState("networkidle"); };
const kpi = (page: Page, label: string) => page.locator("main p", { hasText: new RegExp(`^${label}$`) }).first().locator("xpath=following-sibling::p[1]");

test.describe("analytics page", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  test("staff only: a guest gets the ordinary 404", async ({ page }) => {
    await signInAs(page, "temuulen");
    const res = await page.goto("/en/admin/analytics");
    expect(res?.status()).toBe(404);
  });

  for (const [w, h] of [[1280, 900], [390, 844]] as const) {
    test(`organizer opens every tab at ${w}px with no horizontal scroll and charts named`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      for (const tab of TABS) {
        await page.goto(url(tab));
        await page.locator("main h1").waitFor();
        await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth), tab).toBeLessThanOrEqual(w);
      }
      await page.goto(url("overview"));
      await ready(page);
      const names = await page.locator("svg[role=img]").evaluateAll((els) => els.map((e) => e.getAttribute("aria-labelledby")?.split(" ").map((id) => document.getElementById(id)?.textContent).join(" | ")));
      expect(names.length).toBeGreaterThan(0);
      for (const n of names) expect(n).toMatch(/\S+ \| \S+/);
    });
  }

  for (const scheme of ["light", "dark"] as const) {
    for (const tab of TABS) {
      test(`axe: no WCAG 2.2 A/AA violations on ${tab} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(url(tab));
        await ready(page);
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      });
    }
  }

  test("changing the range updates the URL and the numbers; an empty range shows the no-data state; invalid params fall back", async ({ page }) => {
    await page.goto("/en/admin/analytics");
    await ready(page);
    await expect(page.getByRole("button", { name: /Date range: This semester/ })).toBeVisible();
    const before = await page.locator("main").innerText();

    await page.getByRole("button", { name: /Date range/ }).click();
    await page.getByRole("button", { name: "Last 30 days" }).click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByText(/previous 30 days/)).toBeVisible();
    expect(await page.locator("main").innerText()).not.toBe(before);

    await page.getByRole("button", { name: /Date range/ }).click();
    await page.getByLabel("From", { exact: true }).fill("2001-03-01");
    await page.getByLabel("To", { exact: true }).fill("2001-03-01");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/from=2001-03-01&to=2001-03-01/);
    await expect(page.getByText("No data for this range").first()).toBeVisible();
    expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/NaN|Infinity/);

    await page.goto("/en/admin/analytics?from=2026-02-30&to=nope");
    await ready(page);
    await expect(page.getByRole("button", { name: /Date range: This semester/ })).toBeVisible();
  });

  test("tabs are routed links that keep the range and work from the keyboard", async ({ page }) => {
    await page.goto("/en/admin/analytics?from=2026-10-01&to=2026-10-31");
    await ready(page);
    const nav = page.getByRole("navigation", { name: "Analytics sections" });
    await nav.getByRole("link", { name: "Overview" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(nav.getByRole("link", { name: "Events" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(nav.getByRole("link", { name: "Semesters" })).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/tab=events/);
    await expect(page).toHaveURL(/from=2026-10-01&to=2026-10-31/);
    await expect(nav.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page");
  });

  test("the area chart is inspectable with the keyboard", async ({ page }) => {
    await page.goto("/en/admin/analytics");
    await ready(page);
    const stop = page.getByRole("group", { name: /arrow keys/ });
    await stop.focus();
    await page.keyboard.press("Home");
    await expect(page.getByRole("tooltip")).toContainText("registrations");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tooltip")).toContainText("Sep 2");
  });

  test("Export CSV downloads a UTF-8 BOM file with a header", async ({ page }) => {
    await page.goto("/en/admin/analytics");
    await ready(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^hackum-registrations-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const ch of stream) chunks.push(ch as Buffer);
    const bytes = Buffer.concat(chunks);
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = bytes.subarray(3).toString("utf8").split("\r\n");
    expect(lines[0]).toBe("Date,Registrations");
    expect(lines[1]).toMatch(/^\d{4}-\d{2}-\d{2},\d+$/);
  });

  test("Mongolian renders without overflow and Members explains NUM-only membership", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/mn/admin/analytics?tab=members");
    await page.locator("main h1").waitFor();
    await expect(page.getByText("Гишүүнчлэл зөвхөн МУИС-ийн оюутнуудад нээлттэй")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.goto("/en/admin/analytics?tab=members");
    await expect(page.getByText(/Membership is for NUM students/)).toBeVisible();
  });

  test("the error state offers a retry", async ({ page }) => {
    await page.goto("/en/admin/analytics?state=error");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("KPI deltas never show NaN or Infinity, and Events/Semesters tables render", async ({ page }) => {
    await page.goto("/en/admin/analytics");
    await ready(page);
    await expect(kpi(page, "Registered")).toHaveText(/^\d/);
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|Infinity/);
    await page.goto(url("events"));
    await page.getByRole("table", { name: "Events ranked by registrations" }).waitFor();
    await page.goto(url("semesters"));
    await page.getByRole("table", { name: "Retention by cohort" }).waitFor();
    await expect(page.getByText(/the share who attended again in a later semester/)).toBeVisible();
  });
});

test.describe("dashboard: themed and drills through", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-admin"));

  test("is not flat white: canvas glow, tinted cards, charts present", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en/admin");
    await page.locator("main h1").waitFor();
    await page.getByRole("figure").first().waitFor();
    const bg = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const canvas = document.querySelector(".ops-canvas")!;
      const washed = [...main.querySelectorAll("section, figure, div")].filter((e) => getComputedStyle(e).backgroundImage.includes("radial-gradient")).length;
      return { main: getComputedStyle(main).backgroundColor, canvasImage: getComputedStyle(canvas).backgroundImage, washed };
    });
    expect(bg.main).not.toBe("rgb(255, 255, 255)");
    expect(bg.canvasImage).toContain("gradient");
    expect(bg.washed).toBeGreaterThanOrEqual(6);
    await expect(page.getByRole("heading", { name: "Registrations by day" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "From sign-up to showing up" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "People by school" })).toBeVisible();
  });

  test("axe on the dashboard with charts (light and dark)", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/en/admin");
      await ready(page);
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`), scheme).toEqual([]);
    }
  });

  test("no horizontal scroll at 390 and 1280", async ({ page }) => {
    for (const w of [390, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto("/en/admin");
      await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
    }
  });

  test("needs-attention rows go to the object (F-17)", async ({ page }) => {
    await page.goto("/en/admin");
    const rows = page.locator("#attention ~ ul a, section[aria-labelledby=attention] ul a");
    await rows.first().waitFor();
    const hrefs = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h).toMatch(/^\/en\/admin\/(events\/[^/]+\/registrations\?status=applied|events\?filter=(applications|missing_cover|needs_en)|comms\?status=failed|members\?tab=applications)$/);

    const apps = page.getByRole("link", { name: /hackathon applications? to review/ });
    if (await apps.count()) {
      await expect(apps).toHaveAttribute("href", /^\/en\/admin\/events\/[^/]+\/registrations\?status=applied$/);
      await apps.click();
      await expect(page).toHaveURL(/\/admin\/events\/[^/]+\/registrations/);
      await expect(page.locator("main h1:visible").first()).toBeVisible();
    }
    await page.goto("/en/admin");
    const failed = page.getByRole("link", { name: /emails? failed to send/ });
    if (await failed.count()) {
      await failed.click();
      await expect(page).toHaveURL(/\/admin\/comms\?status=failed/);
      await expect(page.locator("main h1:visible").first()).toBeVisible();
    }
    await page.goto("/en/admin");
    const members = page.getByRole("link", { name: /membership requests? waiting/ });
    if (await members.count()) {
      await expect(members).toHaveAttribute("href", "/en/admin/members?tab=applications");
      await members.click();
      await expect(page).toHaveURL(/\/admin\/members/);
      await expect(page.locator("main h1:visible").first()).toBeVisible();
    }
  });

  test("semester switcher swaps the charts to last semester and Open analytics links on", async ({ page }) => {
    await page.goto("/en/admin");
    await ready(page);
    const label = page.locator("#semester + p");
    const thisLabel = await label.innerText();
    await page.getByRole("link", { name: "Last semester" }).click();
    await expect(page).toHaveURL(/sem=last/);
    await expect(label).not.toHaveText(thisLabel);
    await expect(page.getByRole("link", { name: "Last semester" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "Open analytics" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/analytics/);
    await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
  });
});
