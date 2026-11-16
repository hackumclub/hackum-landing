import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

// Every record this spec creates is prefixed "C2-". The sends only add outbox rows; the audiences used are the
// newsletter subscribers and one event created here with a single attendee, never the whole seed.
test.setTimeout(120_000);
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const EVENT_TITLE = `C2-Event ${stamp}`;
const SUBJECT = `C2-News ${stamp}`;
const SEND = { name: "Send", exact: true } as const;
const DRAFT_KEY = "hackum:announce-draft:v1";

let eventId = "";

const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
/** "142 people (140 will receive it, 2 opted out …)" → the numbers of the card's live count. */
async function countOf(page: Page, name: string) {
  const r = radio(page, name);
  await expect(r).toHaveAccessibleDescription(/\d+ (?:person|people) \(\d+ will receive it, \d+ opted out of announcements\)/);
  const id = (await r.getAttribute("aria-describedby"))!;
  const text = await page.locator(`[id="${id}"]`).innerText();
  const m = text.match(/(\d+) (?:person|people) \((\d+) will receive it, (\d+) opted out/)!;
  return { total: Number(m[1]), will: Number(m[2]), out: Number(m[3]) };
}
async function openComposer(page: Page, query = "") {
  await page.goto(`/en/admin/comms/new${query}`);
  await expect(page.getByRole("heading", { level: 1, name: "New announcement" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who gets it?" })).toBeVisible(); // the form mounts after hydration
}
async function write(page: Page, subject: string, body: string, en?: { subject: string; body: string }) {
  await page.locator('input[name="subject.mn"]').fill(subject);
  await page.locator('textarea[name="body.mn"]').fill(body);
  if (en) {
    await page.locator('input[name="subject.en"]').fill(en.subject);
    await page.locator('textarea[name="body.en"]').fill(en.body);
  }
}
const rateLimited = (page: Page) => page.getByRole("alert").filter({ hasText: "You can send 5 announcements an hour" });

test.describe("access", () => {
  test("a member gets the ordinary 404, a signed-out visitor is sent to sign in", async ({ page }) => {
    await signInAs(page, "anuujin");
    const res = await page.goto("/en/admin/comms/new");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404").first()).toBeVisible();
    await expect(page.getByRole("button", SEND)).toHaveCount(0);
    await signInAs(page, null);
    await page.goto("/en/admin/comms/new");
    await expect(page).toHaveURL(/\/sign-in/);
  });
  test("an organizer is let in", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await openComposer(page);
  });
});

test.describe("setup: an event of our own with one attendee", () => {
  test("create, publish, RSVP as a member", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await page.goto("/en/admin/events/new");
    await page.locator('input[name="title.mn"]:visible').fill(EVENT_TITLE);
    await page.locator('input[name="title.en"]:visible').fill(EVENT_TITLE);
    const slug = await page.locator('input[name="slug"]').inputValue(); // derived from the title
    expect(slug).not.toBe("");
    await page.getByRole("button", { name: "Create event" }).click();
    await page.waitForURL(/\/admin\/events\/e_\d+\?created=1/);
    eventId = page.url().match(/events\/(e_\d+)/)![1];
    await page.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Publish anyway" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();

    await signInAs(page, "anuujin");
    await page.goto(`/en/events/${slug}`);
    await page.getByRole("button", { name: "I’m going" }).click();
    await expect(page.getByRole("button", { name: "Cancel RSVP" }).first()).toBeVisible();
  });
});

test.describe("entry points", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  test("Comms has a New announcement button, and the composer links back", async ({ page }) => {
    await page.goto("/en/admin/comms");
    const link = page.getByRole("link", { name: "New announcement" });
    await expect(link).toHaveAttribute("href", "/en/admin/comms/new");
    await link.click();
    await expect(page.getByRole("heading", { level: 1, name: "New announcement" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: "Comms", exact: true })).toHaveAttribute("href", "/en/admin/comms");
  });

  test("the members bulk bar offers Email segment for the current filter", async ({ page }) => {
    await page.goto("/en/admin/members");
    await page.locator("tbody input[type=checkbox]").first().check();
    const link = page.getByRole("link", { name: "Email segment" });
    await expect(link).toHaveAttribute("href", "/en/admin/comms/new?audience=members");
    await page.goto("/en/admin/members?status=member,alumni");
    await page.locator("tbody input[type=checkbox]").first().check();
    await expect(page.getByRole("link", { name: "Email segment" })).toHaveAttribute("href", "/en/admin/comms/new?audience=community");
  });

  test("an event's registrations page has Message attendees, which pre-selects the event card", async ({ page }) => {
    await page.goto(`/en/admin/events/${eventId}/registrations`);
    const link = page.getByRole("link", { name: "Message attendees" });
    await expect(link).toHaveAttribute("href", `/en/admin/comms/new?audience=event&event=${eventId}&statuses=going`);
    await link.click();
    await expect(page.getByRole("heading", { name: "Who gets it?" })).toBeVisible();
    await expect(radio(page, "People registered for an event")).toBeChecked();
    await expect(page.getByLabel("Event", { exact: true })).toHaveValue(eventId);
    await expect(page.getByRole("button", { name: "Going", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("bad query parameters fall back to the defaults", async ({ page }) => {
    await openComposer(page, "?audience=admins");
    for (const name of ["Members", "Members and alumni", "Everyone with an account", "Newsletter subscribers", "People registered for an event"]) await expect(radio(page, name)).not.toBeChecked();
    await expect(page.getByText("Choose who gets it.")).toBeVisible();
    await openComposer(page, "?audience=event&event=e_nope&statuses=zzz");
    await expect(radio(page, "People registered for an event")).toBeChecked();
    await expect(page.getByLabel("Event", { exact: true })).toHaveValue("");
    await expect(page.getByText("Choose an event first")).toBeVisible();
    await expect(page.getByRole("button", { name: "Going", exact: true })).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("compose and send", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  test("Send says why it is disabled, the preview is a sandboxed iframe of the real email, and the draft survives a reload", async ({ page }) => {
    await openComposer(page);
    const send = page.getByRole("button", SEND);
    await expect(send).toBeDisabled();
    await expect(page.getByText("Choose who gets it.")).toBeVisible();
    await radio(page, "Members").check();
    await expect(page.getByText("Write a subject.")).toBeVisible();
    await page.locator('input[name="subject.mn"]').fill(SUBJECT);
    await expect(page.getByText("Write a message.")).toBeVisible();
    await page.locator('textarea[name="body.mn"]').fill("Hello C2 <script>alert(1)</script>\n\nSecond paragraph");

    const frame = page.getByTestId("preview-frame");
    await expect(frame).toHaveAttribute("sandbox", "");
    await expect(frame).toHaveAttribute("srcdoc", new RegExp(SUBJECT));
    expect(await frame.getAttribute("srcdoc")).not.toContain("<script>alert");
    await expect(page.getByTestId("preview-subject")).toContainText(SUBJECT);
    await expect(frame).toHaveAttribute("title", "Email preview");
    // English is empty: the preview says so and shows Mongolian; typing English switches it
    await expect(page.getByText("English is empty, so the Mongolian text is shown.")).toBeVisible();
    await page.locator('input[name="subject.en"]').fill(`${SUBJECT} EN`);
    await page.locator('textarea[name="body.en"]').fill("English body");
    await page.getByRole("tab", { name: "English" }).click();
    await expect(page.getByTestId("preview-subject")).toContainText(`${SUBJECT} EN`);
    await page.getByRole("tab", { name: "Монгол" }).click();
    await expect(page.getByTestId("preview-subject")).not.toContainText("EN");

    // counter
    await expect(page.getByText(/Mongolian: \d+ \/ 5000/)).toBeVisible();

    // autosave → reload → restored; Discard clears
    await page.waitForTimeout(700);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Who gets it?" })).toBeVisible();
    await expect(page.getByText("Restored your unsent draft from this browser.")).toBeVisible();
    await expect(page.locator('input[name="subject.mn"]')).toHaveValue(SUBJECT);
    await expect(radio(page, "Members")).toBeChecked();
    await page.getByRole("button", { name: "Discard draft" }).click();
    await expect(page.locator('input[name="subject.mn"]')).toHaveValue("");
    await expect(radio(page, "Members")).not.toBeChecked();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
  });

  test("a too-long subject is refused with the count; event statuses and the count follow the chips", async ({ page }) => {
    await openComposer(page, `?audience=event&event=${eventId}&statuses=going`);
    const r = radio(page, "People registered for an event");
    expect(await countOf(page, "People registered for an event")).toEqual({ total: 1, will: 1, out: 0 });
    await page.getByRole("button", { name: "Waitlisted", exact: true }).click();
    await page.getByRole("button", { name: "Going", exact: true }).click();
    await expect.poll(async () => (await countOf(page, "People registered for an event")).total).toBe(0);
    await write(page, "x".repeat(121), "Body");
    await expect(page.getByText("Over the 120 character limit (121).").first()).toBeVisible();
    await expect(page.getByRole("button", SEND)).toBeDisabled();
    await page.getByRole("button", { name: "Waitlisted", exact: true }).click();
    await expect(page.getByText("Pick at least one status.")).toBeVisible();
    await expect(r).toBeChecked();
  });

  test("newsletter subscribers: confirm names the audience and number, one click sends once, a repeat is blocked", async ({ page }) => {
    await openComposer(page);
    await radio(page, "Newsletter subscribers").check();
    const { will, out } = await countOf(page, "Newsletter subscribers");
    test.skip(will === 0, "no subscribers without an account in this data set");
    await write(page, SUBJECT, "Hello subscribers.\n\nSecond paragraph.");
    const send = page.getByRole("button", SEND);
    await expect(send).toBeEnabled();
    await send.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Send “${SUBJECT}” to ${will} newsletter subscribers?`);
    await expect(dialog).toContainText(/Goes out today|About \d+ days: 80 emails go out per day, 20 are kept for confirmations/);
    await expect(dialog).toContainText(out > 0 ? `${out} people who opted out of announcements are skipped.` : "Nobody in this group opted out of announcements.");
    await expect(dialog).toContainText("There is no English version");
    await dialog.getByRole("button", SEND).dblclick(); // a double click must never mail twice

    const toast = page.getByTestId("sent-toast");
    await expect(toast.or(rateLimited(page))).toBeVisible();
    if (await rateLimited(page).isVisible()) return; // five sends this hour already: the limit message is the correct outcome
    await expect(toast).toContainText(`${will} emails queued.`);
    await expect(toast.getByRole("link", { name: "View in Comms" })).toHaveAttribute("href", "/en/admin/comms?template=announcement");
    await expect(toast.getByRole("button", { name: "New announcement" })).toBeVisible();
    // the same message cannot be sent again; the draft is gone
    await expect(send).toBeDisabled();
    await expect(page.getByText("This announcement was sent. Edit it or start a new one to send again.")).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT_KEY)).toBeNull();
    await toast.getByRole("link", { name: "View in Comms" }).click();
    await expect(page).toHaveURL(/\/admin\/comms\?template=announcement/);
    await expect(page.getByRole("heading", { level: 1, name: "Comms" })).toBeVisible();
  });

  test("an event's attendees: English subject in the confirm, success, then New announcement starts clean", async ({ page }) => {
    await openComposer(page, `?audience=event&event=${eventId}&statuses=going`);
    expect((await countOf(page, "People registered for an event")).will).toBe(1);
    await write(page, `${SUBJECT} attendees`, "See you there.", { subject: `${SUBJECT} attendees EN`, body: "See you there (EN)." });
    await page.getByRole("button", SEND).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Send “${SUBJECT} attendees EN” to 1 person registered for “${EVENT_TITLE}”?`);
    await expect(dialog).not.toContainText("There is no English version");
    await dialog.getByRole("button", SEND).click();
    const toast = page.getByTestId("sent-toast");
    await expect(toast.or(rateLimited(page))).toBeVisible();
    if (await rateLimited(page).isVisible()) return;
    await expect(toast).toContainText("1 email queued.");
    await toast.getByRole("button", { name: "New announcement" }).click();
    await expect(page.locator('input[name="subject.mn"]')).toHaveValue("");
    await expect(radio(page, "People registered for an event")).not.toBeChecked();
    await expect(page.getByRole("button", SEND)).toBeDisabled();
  });
});

test.describe("layout and accessibility", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no WCAG 2.2 A/AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openComposer(page, `?audience=event&event=${eventId}&statuses=going`);
      await write(page, "C2-axe subject", "Body text");
      await expect(page.getByTestId("preview-frame")).toHaveAttribute("title", "Email preview");
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude("nextjs-portal")
        .exclude("[data-testid=preview-frame]") // a sandbox="" document cannot run axe (it never answers); the frame itself is checked above for title + sandbox
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }

  for (const [lang, width] of [["en", 390], ["mn", 390], ["en", 768], ["en", 1280]] as const) {
    test(`no horizontal scroll: ${lang} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/${lang}/admin/comms/new?audience=event&event=${eventId}&statuses=going,waitlisted,applied,attended`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.locator('input[name="subject.mn"]').waitFor();
      await write(page, "C2-" + "Урт гарчиг ".repeat(8), "Маш урт үгтэй догол мөр ".repeat(30) + "ЭнэБолУрт".repeat(12));
      await expect(page.getByRole("button", { name: /^(Send|Илгээх)$/ })).toBeVisible();
      if (width < 1024) {
        await page.getByRole("button", { name: /^(Show preview|Урьдчилан харах)$/ }).click();
        await expect(page.getByTestId("preview-frame")).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});
