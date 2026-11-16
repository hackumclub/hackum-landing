import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.setTimeout(120_000);
const stamp = () => Date.now().toString(36);

const MEMBERSHIP = "/en/admin/forms/membership_application";
const questionsHeading = (page: Page) => page.getByRole("heading", { level: 2, name: "Questions" });
/** The newest question's Mongolian label input (BilingualField names are `question-<id>.mn`). */
const lastLabel = (page: Page) => page.locator('input[name^="question-"][name$=".mn"]:visible').last();

/** Add a required short question to the membership form and save; returns its label. */
async function addRequiredQuestion(page: Page, label: string) {
  await page.goto(MEMBERSHIP);
  await expect(questionsHeading(page)).toBeVisible();
  await page.getByRole("button", { name: "Add question" }).click();
  await lastLabel(page).fill(label);
  await page.getByRole("checkbox", { name: "Answer required" }).last().check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Form saved" })).toBeVisible();
}

/** Put the membership form back: remove every question this spec added (their labels start with "D1-"). */
async function removeAdded(page: Page) {
  await signInAs(page, "dev-organizer");
  await page.goto(MEMBERSHIP);
  await expect(questionsHeading(page)).toBeVisible();
  // Remove only the question rows whose Mongolian label starts with "D1-", found by the row itself (not by a stale index).
  for (;;) {
    const rows = page.locator("ol > li").filter({ has: page.locator('input[name^="question-"][name$=".mn"]') });
    const labels = await rows.evaluateAll((els) => els.map((el) => (el.querySelector('input[name^="question-"][name$=".mn"]') as HTMLInputElement).value));
    const i = labels.findIndex((v) => v.startsWith("D1-"));
    if (i < 0) break;
    await rows.nth(i).getByRole("button", { name: "Remove question" }).click();
  }
  const save = page.getByRole("button", { name: "Save", exact: true });
  if (await save.isEnabled()) {
    await save.click();
    await expect(page.getByRole("status").filter({ hasText: "Form saved" })).toBeVisible();
  }
}

test.describe("forms hub", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  test("lists the three kinds of form with counts, filters by kind and search", async ({ page }) => {
    await page.goto("/en/admin/forms");
    await expect(page.getByRole("heading", { level: 1, name: "Forms" })).toBeVisible();
    for (const name of ["All", "Event registration", "Membership", "Join"]) {
      await expect(page.getByRole("tab", { name: new RegExp(`^${name}`) })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Open: Membership application" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open: Join Hackum" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Open: DevHack 2027/ })).toBeVisible();

    await page.getByRole("tab", { name: /^Membership/ }).click();
    await expect(page.getByRole("link", { name: "Open: Membership application" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open: Join Hackum" })).toHaveCount(0);
    await page.getByRole("tab", { name: /^All/ }).click();

    await page.getByRole("searchbox", { name: "Search forms" }).fill("devhack");
    await expect(page.getByRole("link", { name: /^Open: DevHack 2027/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open: Join Hackum" })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search forms" }).fill("zzzz-no-such-form");
    await expect(page.getByRole("heading", { name: "No form matches" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.getByRole("link", { name: "Open: Join Hackum" })).toBeVisible();
  });

  test("a form opens on its questions; the tab is in the URL; event forms are read-only with a link to the event", async ({ page }) => {
    await page.goto("/en/admin/forms");
    await page.getByRole("link", { name: "Open: Join Hackum" }).click();
    await expect(page).toHaveURL(/\/admin\/forms\/join$/);
    await expect(page.getByRole("heading", { level: 1, name: "Join Hackum" })).toBeVisible();
    await page.getByRole("link", { name: /^Responses/ }).click();
    await expect(page).toHaveURL(/\/admin\/forms\/join\?tab=responses$/);

    await page.goto("/en/admin/forms");
    await page.getByRole("link", { name: /^Open: DevHack 2027/ }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    const edit = page.getByRole("link", { name: "Edit in the event" });
    await expect(edit).toHaveAttribute("href", /\/en\/admin\/events\/e_\d+$/);
  });

  test("an unknown or malformed form id is a 404 page, not an empty editor", async ({ page }) => {
    for (const id of ["event%3Anope", "nope", "event%3A..%2F..", "%E0%A4%A"]) {
      await page.goto(`/en/admin/forms/${id}`);
      await expect(page.getByText("404").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Add question" })).toHaveCount(0);
    }
  });

  test("responses: seeded rows with a person link, state, answers by question text, and a drawer with the full answer set", async ({ page }) => {
    await page.goto(`${MEMBERSHIP}?tab=responses`);
    await expect(page.getByRole("link", { name: /^Responses/ })).toHaveAttribute("aria-current", "page");
    const table = page.getByRole("table", { name: "Form responses" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Programming experience" })).toBeVisible();
    const rows = table.locator("tbody tr");
    expect(await rows.count()).toBeGreaterThan(0);
    const person = rows.first().getByRole("link", { name: /^Find in Members:/ });
    await expect(person).toHaveAttribute("href", /\/en\/admin\/members\?q=/);
    await rows.first().getByRole("button", { name: /^View all answers:/ }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Programming experience");
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
  });

  test("Export CSV downloads a file whose first line is the header", async ({ page }) => {
    await page.goto(`${MEMBERSHIP}?tab=responses`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^hackum-membership_application-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const text = Buffer.concat(chunks).toString("utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text.slice(1).split("\r\n")[0]).toMatch(/^Name,Submitted,Status,Programming experience/);
  });

  test("the CSV route answers 401 signed out, 403 for a member, 404 for an unknown form", async ({ page }) => {
    await signInAs(page, null);
    expect((await page.request.get("/api/admin/forms/join/csv")).status()).toBe(401);
    await signInAs(page, "anuujin");
    expect((await page.request.get("/api/admin/forms/join/csv")).status()).toBe(403);
    await signInAs(page, "dev-organizer");
    expect((await page.request.get("/api/admin/forms/event%3Anope/csv")).status()).toBe(404);
    const ok = await page.request.get("/api/admin/forms/join/csv?lang=en");
    expect(ok.status()).toBe(200);
    expect(ok.headers()["content-type"]).toBe("text/csv; charset=utf-8");
    expect(ok.headers()["cache-control"]).toBe("no-store");
  });

  test("members cannot open the hub", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/admin/forms");
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Forms" })).toHaveCount(0);
  });
});

test.describe("membership form editor", () => {
  test.afterEach(async ({ page }) => { await removeAdded(page); });

  test("add a required question: the preview shows it, Save persists it, validation explains an empty label", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await page.goto(MEMBERSHIP);
    await expect(questionsHeading(page)).toBeVisible();
    const preview = page.getByRole("complementary", { name: "What people will see" });
    await expect(preview).toBeVisible();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    // Seeded applications exist: the warning says removing keeps their answers.
    await expect(page.getByRole("note").filter({ hasText: /have already answered; removing a question keeps their answers/ })).toBeVisible();

    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click(); // empty label
    await expect(page.getByRole("status").filter({ hasText: /Fix \d+ fields?/ })).toBeVisible();
    await expect(lastLabel(page)).toBeFocused();

    const label = `D1-${stamp()} Why Hackum?`;
    await lastLabel(page).fill(label);
    await expect(preview.getByText(label)).toBeVisible(); // live preview
    await page.getByRole("checkbox", { name: "Answer required" }).last().check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Form saved" })).toBeVisible();

    await page.reload();
    await expect(lastLabel(page)).toHaveValue(label);
    await expect(page.getByRole("complementary", { name: "What people will see" }).getByText(label)).toBeVisible();
  });

  test("the editor stops at 20 questions and nothing is saved until you press Save", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await page.goto(MEMBERSHIP);
    for (let i = 0; i < 25; i++) {
      const add = page.getByRole("button", { name: "Add question" });
      if (await add.isDisabled()) break;
      await add.click();
    }
    await expect(page.getByRole("button", { name: "Add question" })).toBeDisabled(); // client cap: 20
    await page.reload(); // nothing was saved
    await expect(page.getByRole("button", { name: "Add question" })).toBeEnabled();
  });

  test("an applicant (bayar) sees the new question on /en/me/membership and cannot skip it", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    const label = `D1-${stamp()} Favourite language?`;
    await addRequiredQuestion(page, label);

    await signInAs(page, "bayar");
    await page.goto("/en/me/membership");
    await page.getByRole("heading", { level: 1, name: "Membership" }).waitFor();
    // bayar can apply once per season; after member-app.spec (or an earlier run) there is no form until the demo data is reset.
    test.skip((await page.getByLabel(/Why do you want to join/).count()) === 0, "bayar already applied this season: reset demo data to run this test");
    const field = page.getByLabel(label);
    await expect(field).toBeVisible();
    await page.getByLabel(/Why do you want to join|motivation/i).first().fill("I would like to build things with this club.");
    await page.getByRole("button", { name: /^Apply|Send application|Submit/i }).first().click();
    await expect(page.getByText("Fill in this field.").first()).toBeVisible();
    await expect(page.getByText(/Application (sent|received)/i)).toHaveCount(0);
  });
});

test.describe("quality", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));
  const PATHS = ["/en/admin/forms", "/en/admin/forms/membership_application", "/en/admin/forms/membership_application?tab=responses"];

  for (const scheme of ["light", "dark"] as const) {
    for (const path of PATHS) {
      test(`axe: no WCAG 2.2 A/AA violations on ${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await page.locator("main h1").waitFor();
        await page.waitForLoadState("networkidle");
        const { violations } = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .exclude("nextjs-portal")
          .analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      });
    }
  }

  test.describe("phone", () => {
    test.use({ viewport: { width: 390, height: 800 } });
    for (const path of PATHS) {
      test(`no horizontal scroll at 390 px on ${path}`, async ({ page }) => {
        await page.goto(path);
        await page.locator("main h1").waitFor();
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      });
    }
    test("the hub is a list of cards with Edit and Responses actions", async ({ page }) => {
      await page.goto("/en/admin/forms");
      await expect(page.getByRole("table")).toBeHidden();
      const card = page.getByRole("listitem").filter({ hasText: "Join Hackum" });
      await expect(card.getByRole("link", { name: /^Edit: Join Hackum/ })).toBeVisible();
      await expect(card.getByRole("link", { name: /^View responses: Join Hackum/ })).toBeVisible();
    });
  });

  test("Mongolian: the hub and a form render in Mongolian", async ({ page }) => {
    await page.goto("/mn/admin/forms");
    await expect(page.getByRole("heading", { level: 1, name: "Анкетууд" })).toBeVisible();
    await page.goto("/mn/admin/forms/join?tab=responses");
    await expect(page.getByRole("link", { name: /^Хариултууд/ })).toBeVisible();
  });
});
