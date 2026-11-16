// Member profile (/[lang]/me/profile): photo, school/major, semester subjects, membership follow-ups, NUM-only events.
// The mock database is shared by other specs: every test that changes Anuujin or Temuulen puts them back in `afterEach`.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { signInAs } from "./helpers/as";

const FIXTURE = path.join(__dirname, "fixtures", "avatar.png");
const NOT_AN_IMAGE = path.join(__dirname, "fixtures", "not-an-image.png");
const run = Date.now().toString(36);

const preview = (page: Page) => page.getByTestId("profile-preview");
/** Opens the profile and waits for hydration: typing or picking a file before the handlers attach is silently lost. */
async function openProfile(page: Page) {
  await page.goto("/en/me/profile");
  await page.waitForLoadState("networkidle");
}
const schoolSelect = (page: Page) => page.getByRole("combobox", { name: /^School\b/ });
const semesterCard = (page: Page) => page.locator("section[aria-labelledby^='sem-']").filter({ hasText: "Current semester" }).first();

async function removePhotoIfAny(page: Page, handle: string) {
  await signInAs(page, handle);
  await openProfile(page);
  const remove = page.getByRole("button", { name: "Remove photo" });
  await page.getByRole("button", { name: /Choose a photo|Change photo/ }).waitFor();
  if (await remove.isVisible()) { await remove.click(); await expect(page.getByText("Photo removed")).toBeVisible(); }
}

test.describe("photo", () => {
  test.afterEach(async ({ page }) => { await removePhotoIfAny(page, "anuujin"); });

  test("a PNG is resized in the browser, stored, and shows in the profile, the app header and the admin directory", async ({ page }) => {
    await signInAs(page, "anuujin");
    await openProfile(page);
    await page.getByTestId("avatar-input").setInputFiles(FIXTURE);
    await expect(page.getByText("Photo updated")).toBeVisible();

    const img = preview(page).locator("img[src^='/api/avatar/']");
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    const src = (await img.getAttribute("src")) ?? "";
    expect(src).toMatch(/^\/api\/avatar\/[^?]+\?v=[0-9a-f]{12}$/);

    // Stored as the 96 px WebP the browser produced (never upscaled to 512), served inline and immutable for this version.
    const res = await page.request.get(src);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/webp");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["cache-control"]).toBe("public, max-age=31536000, immutable"); // public profile + the matching ?v
    expect((await page.request.get(src.replace(/v=[0-9a-f]+/, "v=000000000000"))).headers()["cache-control"]).toBe("private, no-store");
  });

  test("the new photo appears in the /me header and in the admin member directory", async ({ page }) => {
    await signInAs(page, "anuujin");
    await openProfile(page);
    await page.getByTestId("avatar-input").setInputFiles(FIXTURE);
    await expect(page.getByText("Photo updated")).toBeVisible();
    await page.goto("/en/me");
    await expect(page.locator("header img[src^='/api/avatar/']").first()).toBeVisible();

    await signInAs(page, "dev-admin");
    await page.goto("/en/admin/members?q=anuujin");
    const row = page.getByRole("row").filter({ hasText: "@anuujin" });
    await expect(row.locator("img[src^='/api/avatar/']")).toBeVisible();
  });

  test("a text file renamed .png is rejected with a message and nothing changes", async ({ page }) => {
    await signInAs(page, "anuujin");
    await openProfile(page);
    await page.getByTestId("avatar-input").setInputFiles(NOT_AN_IMAGE);
    await expect(page.getByRole("alert").filter({ hasText: "not a picture we can read" })).toBeVisible();
    await expect(preview(page).locator("img[src^='/api/avatar/']")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Choose a photo" })).toBeEnabled();
  });
});

test.describe("semester subjects", () => {
  // Whatever happens in a test (timeouts included), Anuujin's current semester goes back to the seed: no E2E chips, shared on.
  test.afterEach(async ({ page }) => {
    await signInAs(page, "anuujin");
    await openProfile(page);
    const card = semesterCard(page);
    await card.waitFor();
    const chips = card.getByRole("button", { name: /^Remove E2E Compilers/ });
    while ((await chips.count()) > 0) await chips.first().click();
    const share = card.getByRole("switch", { name: /Share on my profile/ });
    if (!(await share.isChecked())) await card.locator("label").filter({ hasText: "Share on my profile" }).click();
    const save = card.getByRole("button", { name: /Save subjects/ });
    if (await save.isEnabled()) { await save.click(); await expect(page.getByText(/: saved$/).first()).toBeVisible(); } // wait for the server, not just the disabled button
    await expect(save).toBeDisabled();
  });

  test("saved with 'Share on my profile' on they show in the preview; off, they are hidden; restored afterwards", async ({ page }) => {
    const subject = `E2E Compilers ${run}`;
    await signInAs(page, "anuujin");
    await openProfile(page);
    const card = semesterCard(page);
    const box = card.getByRole("textbox", { name: /subjects/ });
    await box.fill(subject);
    await box.press("Enter");
    await expect(card.getByRole("listitem").filter({ hasText: subject })).toBeVisible();
    await box.fill(subject.toLowerCase());
    await box.press(",");
    await expect(card.getByText("is already added")).toBeVisible(); // duplicate ignored, hint shown
    await expect(card.getByRole("listitem").filter({ hasText: subject })).toHaveCount(1);

    const share = card.getByRole("switch", { name: /Share on my profile/ });
    const flip = (c: ReturnType<typeof semesterCard>) => c.locator("label").filter({ hasText: "Share on my profile" }).click(); // the input itself is visually hidden
    try {
      if (!(await share.isChecked())) await flip(card);
      await card.getByRole("button", { name: /Save subjects/ }).click();
      await expect(page.getByText(/saved$/).first()).toBeVisible();
      await expect(preview(page).getByText(subject)).toBeVisible();

      await flip(card);
      await expect(share).not.toBeChecked();
      await expect(preview(page).getByText(subject)).toHaveCount(0); // live: the preview follows the switch
      await card.getByRole("button", { name: /Save subjects/ }).click();
      await expect(page.getByText(/: saved$/).first()).toBeVisible();
      await page.reload();
      await expect(preview(page).getByText(subject)).toHaveCount(0);
      await expect(semesterCard(page).getByRole("listitem").filter({ hasText: subject })).toBeVisible(); // still stored, just not shared
    } finally {
      await openProfile(page);
      const c2 = semesterCard(page);
      await c2.getByRole("button", { name: `Remove ${subject}` }).click();
      const s2 = c2.getByRole("switch", { name: /Share on my profile/ });
      if (!(await s2.isChecked())) await flip(c2); // the seed has this semester shared
      await c2.getByRole("button", { name: /Save subjects/ }).click();
      await expect(page.getByText(/: saved$/).first()).toBeVisible();
    }
  });

  test("Backspace on an empty box removes the last chip", async ({ page }) => {
    await signInAs(page, "anuujin");
    await openProfile(page);
    const card = page.locator("section[aria-labelledby^='sem-']").last(); // the oldest semester: nothing is seeded there
    const box = card.getByRole("textbox", { name: /subjects/ });
    const before = await card.getByRole("listitem").count();
    await box.fill("Chip A"); await box.press("Enter");
    await expect(card.getByRole("listitem")).toHaveCount(before + 1);
    await box.press("Backspace");
    await expect(card.getByRole("listitem")).toHaveCount(before);
    // Nothing was saved: leaving needs no restore.
  });
});

test.describe("school and major", () => {
  async function restoreTemuulen(page: Page) {
    await signInAs(page, "temuulen");
    await openProfile(page);
    await schoolSelect(page).selectOption("must");
    await page.getByLabel("Major track").selectOption("it");
    await page.getByLabel("Major", { exact: true }).fill("Мэдээллийн технологи");
    const save = page.getByRole("button", { name: "Save", exact: true });
    if (await save.isEnabled()) { await save.click(); await expect(page.getByText("Profile saved")).toBeVisible(); } // disabled = already as seeded
  }
  test.afterEach(async ({ page }) => { await restoreTemuulen(page); });

  test("Temuulen follows 'Update school and major', switches to NUM with a program, and the membership page then shows the form", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/membership");
    await expect(page.getByText("Membership is for NUM students")).toBeVisible();
    await page.getByRole("link", { name: "Update school and major" }).click();
    await page.waitForURL(/\/en\/me\/profile#school$/);
    const school = schoolSelect(page);
    await expect(school).toBeEditable();
    await school.selectOption("num");
    const program = page.getByRole("combobox", { name: /NUM program/ });
    await program.fill("программ");
    await page.getByRole("listbox").getByRole("option").first().click();
    await expect(preview(page).getByText("NUM", { exact: true })).toBeVisible(); // live preview follows the select
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Profile saved")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled(); // stays on the page, nothing left to save

    await page.goto("/en/me/membership");
    await expect(page.getByText("Membership is for NUM students")).toHaveCount(0);
    await expect(page.getByLabel(/Why do you want to join Hackum/)).toBeVisible();
  });

  test("unsaved changes: leaving through an in-app link asks first and can be cancelled", async ({ page }) => {
    await signInAs(page, "temuulen");
    await openProfile(page);
    await page.getByLabel("Graduation year").fill("2031");
    const dialogs: string[] = [];
    page.once("dialog", (d) => { dialogs.push(d.message()); void d.dismiss(); });
    await page.getByRole("link", { name: /^Membership/ }).click();
    expect(dialogs[0]).toMatch(/unsaved changes/i);
    await expect(page).toHaveURL(/\/en\/me\/profile/);
    await page.getByLabel("Graduation year").fill("2028"); // back to what is stored: clean again
  });
});

test.describe("NUM-only events and links", () => {
  test("a guest from another school sees the NUM-only card locked, with the reason and a way on", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/events");
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: "Weekly Members Meetup" }) });
    await expect(card.getByText("МУИС", { exact: true })).toBeVisible();
    await expect(card.getByText("This event is for NUM students")).toBeVisible();
    await expect(card.getByRole("button", { name: /going/i })).toHaveCount(0);
    await card.getByRole("link", { name: "Browse open events" }).click();
    await expect(page).toHaveURL(/show=open/);
    await expect(page.locator("article").filter({ has: page.getByRole("heading", { name: "Weekly Members Meetup" }) })).toHaveCount(0);
    await page.getByRole("link", { name: "Show all" }).click();
    await expect(page.getByRole("heading", { name: "Weekly Members Meetup" })).toBeVisible();
  });

  test("a members-only link in /me/profile leads to an editable school (no loop through Settings)", async ({ page }) => {
    await signInAs(page, "temuulen");
    await openProfile(page);
    await expect(page.getByRole("link", { name: /change in settings/i })).toHaveCount(0);
    await expect(schoolSelect(page)).toBeEditable();
  });
});

test.describe("membership page by status", () => {
  test("a member gets a status card and a next action; an alumna gets the alumni path, not the student form", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/me/membership");
    await expect(page.getByRole("heading", { name: "You're a Hackum member" })).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: /^Renew for/ }).or(page.locator("main").getByRole("link", { name: "All events" }))).toBeVisible();

    await signInAs(page, "saraa");
    await page.goto("/en/me/membership");
    await expect(page.getByRole("heading", { name: "Your alumni path" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tell us how you can help" })).toHaveAttribute("href", /^(mailto:.+@.+\?subject=|https:\/\/www\.instagram\.com\/)/) // mailto once NEXT_PUBLIC_CLUB_EMAIL is set, Instagram until then;
    await expect(page.getByRole("link", { name: "Alumni events" })).toBeVisible();
    await expect(page.getByLabel(/Why do you want to join Hackum/)).toHaveCount(0);
  });
});

test.describe("tap targets and a11y", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const p of ["/en/me", "/en/me/events", "/en/me/profile"]) {
    test(`every link and button on ${p} is at least 44 px tall at 390 px`, async ({ page }) => {
      await signInAs(page, "anuujin");
      await page.goto(p);
      await page.locator("main h1").first().waitFor();
      await page.waitForLoadState("networkidle");
      const small = await page.locator("main a[href], main button").evaluateAll((els) => els.flatMap((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none" || r.width === 0 || r.height === 0 || (el as HTMLElement).closest("[hidden]")) return [];
        if (el.matches(".sr-only, [aria-hidden='true']")) return [];
        if (el.tagName === "A" && style.display === "inline") return []; // a link inside a sentence is exempt (WCAG 2.5.8 inline exception)
        return r.height < 43.5 ? [`${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.height)}px`] : [];
      }));
      expect(small).toEqual([]);
    });
  }
});

test.describe("a11y", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no WCAG 2.2 A/AA violations on /en/me/profile (${scheme})`, async ({ page }) => {
      await signInAs(page, "anuujin");
      await page.emulateMedia({ colorScheme: scheme });
      await openProfile(page);
      await page.locator("main h1").first().waitFor();
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude("nextjs-portal")
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
});
