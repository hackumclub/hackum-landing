// Sign in (email code, passkey), create account / Join, and the dev-only demo accounts.
// The mock database is shared and mutable: new accounts use a unique prefix, and nothing asserts global counts.
// Emails of the seeded personas come from the deterministic seed (src/lib/mockdb/seed.ts: `handle@domain`).
// A code can be requested 5 times an hour per email, so each persona is signed in at most once per run here.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.use({ reducedMotion: "reduce" }); // the site's smooth scroll otherwise moves buttons while Playwright clicks

const ANUUJIN = "anuujin@example.edu.mn";
const ADMIN = "dev-admin@example.com";
const BAYAR = "bayar@example.com"; // NUM guest persona with no passkey
const unique = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// On /join the newsletter form below has an email box too: the account form comes first.
const emailBox = (page: Page) => page.getByRole("textbox", { name: /^Email/ }).first();

/** Step 1 of the sign-in form, then returns the code the demo shows. */
async function requestCode(page: Page, email: string): Promise<string> {
  await emailBox(page).fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  const box = page.getByText(/Dev: your code is \d{6}/);
  await expect(box).toBeVisible();
  return (await box.innerText()).match(/\d{6}/)![0];
}
const codeInput = (page: Page) => page.getByRole("textbox", { name: /^6-digit code/ });

test.beforeEach(async ({ page }) => { await signInAs(page, null); });

test.describe("sign-in page", () => {
  test("shows the two methods as tabs, a link to Create account, and demo accounts collapsed", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Hackum" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Email code" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Passkey" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", "/en/join");
    const demo = page.locator("details[data-demo-accounts]");
    await expect(demo).toBeVisible();
    expect(await demo.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
    await expect(page.getByRole("button", { name: "Continue as this person" }).first()).toBeHidden();
    await demo.locator("summary").click();
    await expect(page.getByRole("button", { name: "Continue as this person" }).first()).toBeVisible();
  });

  test("a member signs in with the emailed code and lands on /en/me", async ({ page }) => {
    await page.goto("/en/sign-in");
    const code = await requestCode(page, ANUUJIN);
    await codeInput(page).fill(code);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/en\/me$/);
  });

  test("the club leader signs in with a code and lands in the backoffice; ?next= is followed", async ({ page }) => {
    await page.goto("/en/sign-in?next=%2Fen%2Fadmin%2Fevents");
    const code = await requestCode(page, ADMIN);
    await codeInput(page).fill(code);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/en\/admin\/events$/);
  });

  test("a wrong code shows an error beside the field, wired with aria-describedby", async ({ page }) => {
    await page.goto("/en/sign-in");
    const code = await requestCode(page, `${unique("nobody")}@example.com`);
    const wrong = code === "000000" ? "111111" : "000000";
    const input = codeInput(page);
    await input.fill(wrong);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const message = page.getByText(/That code is wrong or has expired/);
    await expect(message).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const describedBy = (await input.getAttribute("aria-describedby")) ?? "";
    const ids = describedBy.split(" ");
    const texts = await Promise.all(ids.map((id) => page.locator(`[id="${id}"]`).innerText()));
    expect(texts.join(" ")).toMatch(/wrong or has expired/);
    await expect(input).toBeFocused();
    expect(new URL(page.url()).pathname).toBe("/en/sign-in");
  });

  test("an email with no account gets an honest message after a correct code", async ({ page }) => {
    await page.goto("/en/sign-in");
    const code = await requestCode(page, `${unique("ghost")}@example.com`);
    await codeInput(page).fill(code);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText(/No account uses this email/)).toBeVisible();
  });

  test("passkey tab: an account without a passkey gets the honest explanation", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.getByRole("tab", { name: "Passkey" }).click();
    await emailBox(page).fill(BAYAR);
    await page.getByRole("button", { name: "Use passkey" }).click();
    const input = emailBox(page);
    await expect(page.getByText("This account has no passkey. Sign in with a code, then add one in Settings.")).toBeVisible();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(new URL(page.url()).pathname).toBe("/en/sign-in");
  });

  test("an invalid email is caught before anything is sent", async ({ page }) => {
    await page.goto("/en/sign-in");
    await emailBox(page).fill("not-an-email");
    await page.getByRole("button", { name: "Send code" }).click();
    await expect(page.getByText(/Enter a valid email address/)).toBeVisible();
    await expect(page.getByText(/Dev: your code/)).toHaveCount(0);
  });

  test("Mongolian page works the same way", async ({ page }) => {
    await page.goto("/mn/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Hackum-д нэвтрэх" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Имэйл код" })).toBeVisible();
  });

  test("a demo account that does not exist says so instead of bouncing silently (F-06)", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.locator("details[data-demo-accounts] summary").click();
    await page.locator("details[data-demo-accounts] input[name=handle]").first().evaluate((el) => { (el as HTMLInputElement).value = "ghost-account"; });
    await page.getByRole("button", { name: "Continue as this person" }).first().click();
    await page.waitForURL(/\/en\/sign-in\?.*error=unknown/);
    await expect(page.getByRole("alert").filter({ hasText: /demo account does not exist/ })).toBeVisible();
  });

  test("a demo account still signs in and lands where it should", async ({ page }) => {
    await page.goto("/en/sign-in");
    await page.locator("details[data-demo-accounts] summary").click();
    await page.locator("li", { hasText: /Dev organizer/ }).getByRole("button").click();
    await page.waitForURL(/\/en\/admin$/);
  });
});

test.describe("slides panel", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 1280, height: 900 } });
  test("three slides advance by themselves, pause on hover, and can be driven from the keyboard", async ({ page }) => {
    await page.goto("/en/sign-in");
    const panel = page.getByRole("region", { name: "About Hackum" });
    await expect(panel).toBeVisible();
    const dots = panel.getByRole("button", { name: /Go to slide/ });
    await expect(dots).toHaveCount(3);
    await expect(dots.nth(0)).toHaveAttribute("aria-current", "true");
    await page.clock.install();
    await page.reload();
    // The fake clock only moves when told to: advance a second at a time until the page has hydrated and the first 6 s are up.
    await expect(async () => {
      await page.clock.runFor(1_000);
      await expect(dots.nth(1)).toHaveAttribute("aria-current", "true", { timeout: 200 });
    }).toPass({ timeout: 20_000 });
    await panel.hover();
    await page.clock.runFor(20_000);
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
    await panel.getByRole("button", { name: "Next slide" }).focus();
    await page.keyboard.press("Enter");
    await expect(dots.nth(2)).toHaveAttribute("aria-current", "true");
  });
});

test.describe("slides panel, reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  test("stays on the first slide until asked", async ({ page }) => {
    await page.clock.install();
    await page.goto("/en/sign-in");
    const panel = page.getByRole("region", { name: "About Hackum" });
    await page.clock.fastForward(30_000);
    await expect(panel.getByRole("button", { name: /Go to slide/ }).nth(0)).toHaveAttribute("aria-current", "true");
    await expect(panel.getByRole("button", { name: /Pause slides/ })).toHaveCount(0);
  });
});

test.describe("slides panel below lg", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("collapses to a short banner and the page does not scroll sideways", async ({ page }) => {
    await page.goto("/en/sign-in");
    await expect(page.getByRole("region", { name: "About Hackum" })).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Sign in to Hackum" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

/** Fills the Join form for a NUM software student (or another school) and returns the unique name used. */
async function fillJoin(page: Page, opts: { school?: "must"; motivation?: string } = {}) {
  const name = unique("Zed");
  const email = `${unique("join")}@example.com`;
  await page.goto("/en/join");
  await page.getByRole("textbox", { name: /^Name \(in Mongolian\)/ }).fill(name);
  await emailBox(page).fill(email);
  if (opts.school) await page.getByRole("combobox", { name: /^School/ }).selectOption(opts.school);
  else await page.getByRole("combobox", { name: /^Major track/ }).selectOption("software");
  if (opts.motivation) await page.getByRole("textbox", { name: /^Why do you want to join/ }).fill(opts.motivation);
  return { name, email };
}
async function confirmJoin(page: Page) {
  await page.getByRole("button", { name: "Send code" }).click();
  const box = page.getByText(/Dev: your code is \d{6}/);
  await expect(box).toBeVisible();
  const code = (await box.innerText()).match(/\d{6}/)![0];
  await codeInput(page).fill(code);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/en\/me/);
}

test.describe("join", () => {
  test("a NUM software student joins and files an application that staff see in Members > Applications", async ({ page, browser }) => {
    const { name } = await fillJoin(page, { motivation: "I want to build things with other students." });
    await expect(page.getByText(/You study at NUM, so you can apply for membership/)).toBeVisible();
    await confirmJoin(page);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    const staff = await browser.newContext();
    const sp = await staff.newPage();
    await signInAs(sp, "dev-admin");
    await sp.goto("/en/admin/members/applications");
    await sp.locator("main h1").waitFor();
    await expect(sp.getByText(name).first()).toBeVisible();
    await staff.close();
  });

  test("a MUST student reads that they join as a guest before submitting, and ends as a guest with no application", async ({ page, browser }) => {
    const { name } = await fillJoin(page, { school: "must", motivation: "" });
    await expect(page.getByText("You will join as a guest")).toBeVisible();
    await expect(page.getByText("Members must study at NUM; you can still RSVP to open events.", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("textbox", { name: /^Why do you want to join/ })).toHaveCount(0); // no membership section for other schools
    await confirmJoin(page);
    const staff = await browser.newContext();
    const sp = await staff.newPage();
    await signInAs(sp, "dev-admin");
    await sp.goto("/en/admin/members/applications");
    await sp.locator("main h1").waitFor();
    await expect(sp.getByText(name)).toHaveCount(0);
    await staff.close();
  });

  test("required fields are flagged beside the field and focus moves to the first one", async ({ page }) => {
    await page.goto("/en/join");
    await page.getByRole("button", { name: "Send code" }).click();
    const first = page.getByRole("textbox", { name: /^Name \(in Mongolian\)/ });
    await expect(first).toHaveAttribute("aria-invalid", "true");
    await expect(first).toBeFocused();
    await expect(page.getByRole("alert").filter({ hasText: "Fix the fields marked in red" })).toBeVisible();
    await expect(emailBox(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(/Dev: your code/)).toHaveCount(0);
  });

  test("an existing email only signs in: no new account", async ({ page }) => {
    await page.goto("/en/join");
    await page.getByRole("textbox", { name: /^Name \(in Mongolian\)/ }).fill("Someone Else");
    await emailBox(page).fill("saraa@example.edu.mn");
    await page.getByRole("button", { name: "Send code" }).click();
    const box = page.getByText(/Dev: your code is \d{6}/);
    await expect(box).toBeVisible();
    await codeInput(page).fill((await box.innerText()).match(/\d{6}/)![0]);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/en\/me/);
  });

  test("the newsletter form is still on the page as a small secondary section", async ({ page }) => {
    await page.goto("/en/join");
    await expect(page.getByRole("region", { name: "Only want event news?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Notify me" })).toBeVisible();
  });

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test("no horizontal scroll in English or Mongolian, with the long form filled in", async ({ page }) => {
      for (const path of ["/en/join", "/mn/join", "/en/sign-in", "/mn/sign-in"]) {
        await page.goto(path);
        await page.locator("main h1").first().waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
      }
      await page.goto("/mn/join");
      await page.getByRole("combobox", { name: /^Сургууль/ }).selectOption("must");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
});

for (const scheme of ["light", "dark"] as const) {
  for (const path of ["/en/sign-in", "/mn/sign-in", "/en/join", "/mn/join"]) {
    test(`axe: no WCAG 2.2 A/AA violations on ${path} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.locator("main h1").first().waitFor();
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude("nextjs-portal")
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
}
