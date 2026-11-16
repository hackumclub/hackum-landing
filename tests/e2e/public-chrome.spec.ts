// Task 14: the public chrome knows who you are (F-01), the RSVP panel explains school restrictions (F-12), the Code of
// Conduct has a way to report and a way on (F-10).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.use({ reducedMotion: "reduce" });

const header = (page: Page) => page.locator("header");
const accountMenu = (page: Page) => header(page).getByRole("button", { name: /^Account menu/ });
const popup = (page: Page) => header(page).getByRole("group", { name: "Account menu" });
const openMenu = async (page: Page) => { await page.getByRole("button", { name: "Menu", exact: true }).click(); return page.locator("#mobile-nav"); };

test.describe("signed out", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, null); });

  test("header and footer offer Sign in and Join", async ({ page }) => {
    await page.goto("/en");
    await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/sign-in");
    await expect(header(page).getByRole("link", { name: "Join" })).toHaveAttribute("href", "/en/join");
    await expect(accountMenu(page)).toHaveCount(0);
    await expect(page.locator("footer").getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/sign-in");
  });

  test("Mongolian chrome says Нэвтрэх", async ({ page }) => {
    await page.goto("/mn");
    await expect(header(page).getByRole("link", { name: "Нэвтрэх" })).toHaveAttribute("href", "/mn/sign-in");
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("the Menu has Sign in and Join", async ({ page }) => {
      await page.goto("/en");
      const menu = await openMenu(page);
      await expect(menu.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/en/sign-in");
      await expect(menu.getByRole("link", { name: "Join" })).toHaveAttribute("href", "/en/join");
    });
  });

  test("the event page offers sign in first and create account second", async ({ page }) => {
    await page.goto("/en/events/knowledge-day-rag");
    const panel = page.getByRole("region", { name: "Registration" });
    await expect(panel.getByRole("link", { name: /^Sign in/ })).toBeVisible();
    await expect(panel.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/en/join");
  });
});

test.describe("signed in", () => {
  test("a member gets an avatar menu with My Hackum and Sign out, and no Dashboard or Join", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/about");
    await expect(header(page).getByRole("link", { name: "Join" })).toHaveCount(0);
    await expect(header(page).getByRole("link", { name: "Sign in" })).toHaveCount(0);
    const trigger = accountMenu(page);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(header(page).getByRole("link", { name: "My Hackum" }).first()).toBeVisible(); // also visible without opening the menu on wide bars
    await expect(popup(page).getByRole("link", { name: "My Hackum" })).toHaveAttribute("href", "/en/me");
    await expect(popup(page).getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(header(page).getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
    await expect(page.locator("footer").getByRole("link", { name: "My Hackum" })).toHaveAttribute("href", "/en/me");
  });

  test("an organizer also gets Dashboard", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await page.goto("/en/events");
    await accountMenu(page).click();
    await expect(popup(page).getByRole("link", { name: "My Hackum" })).toBeVisible();
    await expect(popup(page).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/en/admin");
    await expect(page.locator("footer").getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/en/admin");
  });

  test("Sign out ends the session and the chrome offers Sign in again", async ({ page }) => {
    await signInAs(page, "saraa");
    await page.goto("/en");
    await accountMenu(page).click();
    await popup(page).getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/en$/);
    await expect(header(page).getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.goto("/en/me");
    await page.waitForURL(/\/en\/sign-in/);
  });

  test("a click outside closes the menu", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en");
    const trigger = accountMenu(page);
    await trigger.click();
    await page.mouse.click(5, 400);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("the Menu has My Hackum (and Dashboard for staff) and Sign out; the page does not scroll sideways", async ({ page }) => {
      await signInAs(page, "dev-organizer");
      await page.goto("/en");
      const menu = await openMenu(page);
      await expect(menu.getByRole("link", { name: "My Hackum" })).toHaveAttribute("href", "/en/me");
      await expect(menu.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/en/admin");
      await expect(menu.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(menu.getByRole("link", { name: "Sign in" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await menu.getByRole("link", { name: "My Hackum" }).click();
      await page.waitForURL(/\/en\/me/);
    });
  });
});

test.describe("members-only and NUM-only events (F-12)", () => {
  test("a student from another school is told 'NUM students only' with a way on, never sent to the newsletter", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/events/members-meetup-live");
    const panel = page.getByRole("region", { name: "Registration" });
    await expect(panel.getByText("NUM students only")).toBeVisible();
    await expect(panel.getByRole("link", { name: "How membership works" })).toHaveAttribute("href", "/en/me/membership");
    await expect(panel.getByRole("link", { name: "Browse open events" })).toHaveAttribute("href", "/en/events");
    await expect(panel.locator('a[href="/en/join"]')).toHaveCount(0);
    await expect(panel.getByRole("button")).toHaveCount(0);
  });

  test("the school scope is a tag on the public event page", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/events/members-meetup-live");
    await expect(page.locator('[data-school-scope="num"]').getByText("МУИС")).toBeVisible();
    await page.goto("/en/events/knowledge-day-rag");
    await expect(page.locator('[data-school-scope="all"]').getByText("All schools")).toBeVisible();
  });

  test("Mongolian copy for the same panel", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/mn/events/members-meetup-live");
    await expect(page.getByText("Зөвхөн МУИС-ийн оюутнуудад")).toBeVisible();
  });
});

test.describe("code of conduct (F-10)", () => {
  test("has a way to report a problem and a way back", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/code-of-conduct");
    const report = page.getByRole("region", { name: "Report a problem" });
    await expect(report.getByRole("link", { name: /Instagram/ })).toHaveAttribute("href", /instagram\.com\/hackumclub/);
    await expect(report.getByRole("link", { name: "Back to the home page" })).toHaveAttribute("href", "/en");
    await expect(report.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/en/events");
    expect(await page.locator("main a[href], main button").count()).toBeGreaterThan(0);
  });
});

for (const scheme of ["light", "dark"] as const) {
  for (const [who, path] of [[null, "/en/code-of-conduct"], ["temuulen", "/en/events/members-meetup-live"], ["anuujin", "/en/code-of-conduct"]] as const) {
    test(`axe: public chrome on ${path} as ${who ?? "visitor"} (${scheme})`, async ({ page }) => {
      await signInAs(page, who);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.locator("main").first().waitFor();
      if (who) await accountMenu(page).click();
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude("nextjs-portal")
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
}
