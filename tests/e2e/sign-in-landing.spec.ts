import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers/as";

// Reduced motion also turns off the site's smooth scrolling, which otherwise moves a lower card's button while Playwright is clicking it.
test.use({ reducedMotion: "reduce" });

// Where you land after signing in should be your home: staff go to the backoffice, everyone else to their member app.
test.describe("sign-in landing", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, null); });

  const pick = async (page: import("@playwright/test").Page, name: RegExp, url = "/en/sign-in") => {
    await page.goto(url);
    await page.locator("details[data-demo-accounts] summary").click(); // the demo accounts are collapsed by default
    await page.locator("li", { hasText: name }).getByRole("button").click();
  };

  test("an admin lands in the backoffice", async ({ page }) => {
    await pick(page, /Dev admin/);
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
  test("an organizer lands in the backoffice", async ({ page }) => {
    await pick(page, /Dev organizer/);
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
  test("a member lands in the member app", async ({ page }) => {
    await pick(page, /Member \(Anuujin\)/);
    await expect(page).toHaveURL(/\/en\/me$/);
  });
  test("a requested page wins over the default", async ({ page }) => {
    await pick(page, /Member \(Anuujin\)/, "/en/sign-in?next=%2Fen%2Fme%2Fevents");
    await expect(page).toHaveURL(/\/en\/me\/events$/);
  });
  test("the backoffice is not offered as a landing page to non-staff who ask for it", async ({ page }) => {
    await pick(page, /Guest \(Temuulen\)/, "/en/sign-in?next=%2Fen%2Fadmin");
    await expect(page.getByText("coffee not found")).toBeVisible(); // ordinary 404, no hint that /admin exists
  });
});
