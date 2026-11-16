import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.setTimeout(120_000);

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const switchNav = (page: Page) => page.getByRole("navigation", { name: "Choose area" }).filter({ visible: true });

test.describe("organizer", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-organizer"); });

  test("sees the context switch in both shells, switching keeps the session, and has no Settings or Audit", async ({ page }) => {
    await page.goto("/en/admin");
    await expect(switchNav(page)).toBeVisible();
    await expect(switchNav(page).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    const sidebar = page.getByRole("navigation", { name: "Admin menu" }).first();
    for (const name of ["Dashboard", "Events", "Members", "Forms", "Analytics", "Comms", "Inbox"]) await expect(sidebar.getByRole("link", { name })).toBeVisible();
    for (const name of ["Settings", "Audit"]) await expect(sidebar.getByRole("link", { name })).toHaveCount(0);

    await switchNav(page).getByRole("link", { name: "Hackum" }).click();
    await expect(page).toHaveURL(/\/en\/me$/);
    await expect(switchNav(page)).toBeVisible();
    await expect(switchNav(page).getByRole("link", { name: "Hackum" })).toHaveAttribute("aria-current", "page");

    await switchNav(page).getByRole("link", { name: "Dashboard" }).click();
    await expect(page).toHaveURL(/\/en\/admin$/);
    expect((await page.request.get("/en/admin/events", { maxRedirects: 0 })).status()).toBe(200); // still signed in as the organizer
  });

  test("Site opens the public home in the same tab", async ({ page }) => {
    await page.goto("/en/admin");
    await switchNav(page).getByRole("link", { name: "Site" }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test("by URL, /admin/settings and /admin/audit are the 404 page", async ({ page }) => {
    for (const path of ["/en/admin/settings", "/en/admin/audit"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/not found/i);
    }
  });
});

test.describe("admin", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test("sees every section and both switch segments", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.goto("/en/admin");
    const sidebar = page.getByRole("navigation", { name: "Admin menu" }).first();
    for (const name of ["Dashboard", "Events", "Members", "Forms", "Analytics", "Comms", "Inbox", "Settings", "Audit"]) await expect(sidebar.getByRole("link", { name })).toBeVisible();
    await expect(switchNav(page)).toBeVisible();
  });

  test("the avatar menu has Profile, Notifications, Settings, Switch demo account and Sign out; the old View-as select is gone", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.goto("/en/admin");
    await expect(page.getByLabel("View as")).toHaveCount(0);
    const button = page.getByRole("button", { name: "Account menu" });
    await button.click();
    const menu = page.locator("#avatar-menu");
    await expect(menu.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/en/me/profile");
    await expect(menu.getByRole("link", { name: /Notifications/ })).toHaveAttribute("href", "/en/admin/inbox");
    await expect(menu.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(menu.getByText("Switch demo account")).toBeVisible();
    await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test("Switch demo account changes the person: to a member the backoffice disappears", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.goto("/en/admin");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.locator("#avatar-menu").getByText("Switch demo account").click();
    await page.locator("#avatar-menu").getByRole("button", { name: /Member \(Anuujin\)/ }).click();
    await expect(page).toHaveURL(/\/en\/me$/);
    await expect(switchNav(page)).toHaveCount(0);
    expect((await page.request.get("/en/admin", { maxRedirects: 0 })).status()).toBe(404);
  });

  test("the language link keeps the query string (F-09)", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.goto("/en/admin/comms?status=failed");
    await expect(page.locator("a[hreflang='mn']").first()).toHaveAttribute("href", "/mn/admin/comms?status=failed");
  });
});

test.describe("member", () => {
  test("Anuujin has no switch, and /en/admin is a 404", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/me");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(switchNav(page)).toHaveCount(0);
    const res = await page.goto("/en/admin");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/not found/i);
  });

  test("1280: /en/me shows the left rail (260 px), the right column, and has no horizontal scroll", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/me");
    await page.waitForLoadState("networkidle");
    const rail = page.getByRole("navigation", { name: "Main menu" }).filter({ visible: true });
    await expect(rail).toHaveCount(1);
    await expect(rail.getByRole("link", { name: "Events" })).toBeVisible();
    await expect(rail.getByRole("link", { name: "Notifications" })).toBeVisible();
    const railBox = await rail.evaluate((el) => el.parentElement!.parentElement!.getBoundingClientRect().width);
    expect(Math.round(railBox)).toBe(260);
    await expect(page.getByRole("heading", { name: "Badges" }).filter({ visible: true })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    // below the laptop breakpoint the rail is gone and the floating tab bar is back
    await page.setViewportSize({ width: 900, height: 800 });
    await expect(page.locator("main").getByRole("navigation", { name: "Main menu" })).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("390: the bottom tabs are still at least 44 px tall and nothing scrolls sideways", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/me");
    await page.waitForLoadState("networkidle");
    const tabs = page.getByRole("navigation", { name: "Main menu" }).filter({ visible: true }).getByRole("link");
    await expect(tabs).toHaveCount(4);
    for (const box of await tabs.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))) expect(box).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole("button", { name: /Notifications/ })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("page titles (F-19)", () => {
  test("each admin page and /me home has its own title", async ({ page }) => {
    await signInAs(page, "dev-admin");
    const titles: Record<string, string> = {};
    for (const [path, expected] of [["/en/admin", /^Dashboard \| /], ["/en/admin/events", /^Events \| /], ["/en/admin/members", /^Members \| /], ["/en/admin/comms", /^Comms \| /], ["/en/admin/audit", /^Audit log \| /], ["/en/admin/inbox", /^Inbox \| /]] as const) {
      await page.goto(path);
      await expect(page).toHaveTitle(expected);
      titles[path] = await page.title();
    }
    expect(new Set(Object.values(titles)).size).toBe(Object.keys(titles).length);
    await signInAs(page, "anuujin");
    await page.goto("/en/me");
    await expect(page).toHaveTitle(/^Home \| My Hackum$/);
    await page.goto("/en/me/notifications");
    await expect(page).toHaveTitle(/^Notifications \| My Hackum$/);
  });
});

// The dashboard itself is scanned by a11y.spec; here the shell is scanned on the inbox page so the result is the shell's own.
for (const scheme of ["light", "dark"] as const) {
  for (const [who, path] of [["dev-admin", "/en/admin/inbox"], ["dev-organizer", "/mn/admin/inbox"], ["anuujin", "/en/me"], ["dev-organizer", "/en/me"], ["anuujin", "/en/me/notifications"]] as const) {
    test(`axe: no WCAG 2.2 A/AA violations on ${path} as ${who} (${scheme})`, async ({ page }) => {
      await signInAs(page, who);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.locator("main h1").first().waitFor();
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
}
