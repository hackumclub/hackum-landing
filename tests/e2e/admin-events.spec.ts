import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.setTimeout(120_000);
const WIDTHS = [360, 768, 1280];
const stamp = () => `${Date.now().toString(36)}`;

/** Id of a seeded event, found through the list (ids are generated, titles are stable). */
async function eventId(page: Page, title: string) {
  await page.goto("/en/admin/events");
  const link = page.getByRole("link", { name: new RegExp(`^Open: ${title}`) });
  const href = await link.first().getAttribute("href");
  return href!.split("/").pop()!;
}

/** Creates a draft event through the form and returns its id. Unique title so reruns and other agents never collide. */
async function createDraft(page: Page, title: string, extra?: (p: Page) => Promise<void>) {
  await page.goto("/en/admin/events/new");
  await page.locator('input[name="title.mn"]:visible').fill(title);
  await page.locator('input[name="title.en"]:visible').fill(title);
  await extra?.(page);
  await page.getByRole("button", { name: "Create event" }).click();
  await page.waitForURL(/\/admin\/events\/e_\d+\?created=1/);
  return page.url().match(/events\/(e_\d+)/)![1];
}

test.describe("access", () => {
  test("non-staff get a 404 on every events route and the CSV export", async ({ page }) => {
    await signInAs(page, "anuujin");
    for (const path of ["/en/admin/events", "/en/admin/events/new"]) {
      await page.goto(path);
      await expect(page.getByText("404").first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Create event" })).toHaveCount(0);
    }
    const res = await page.request.get("/en/admin/events/e_1/registrations/export");
    expect(res.status()).toBe(404);
  });

  test("signed-out visitors get a 404 for the CSV export, an organizer is let in", async ({ page }) => {
    await signInAs(page, null);
    expect((await page.request.get("/en/admin/events/e_1/registrations/export")).status()).toBe(404);
    await signInAs(page, "dev-organizer");
    await page.goto("/en/admin/events");
    await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
  });
});

test.describe("list", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-admin"));

  test("tabs with live counts, search, kind filter, results line, registration summaries", async ({ page }) => {
    await page.goto("/en/admin/events");
    await expect(page.getByRole("heading", { level: 1, name: "Events" })).toBeVisible();
    const results = page.getByRole("status").filter({ hasText: /\d+ results?/ });
    await expect(results).toBeVisible();
    const total = Number((await results.innerText()).match(/\d+/)![0]);
    expect(total).toBeGreaterThanOrEqual(10);

    const archived = page.getByRole("button", { name: /^Archived \d+$/ });
    await archived.click();
    await expect(archived).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/participants \(past\)/).locator("visible=true").first()).toBeVisible(); // legacy count instead of capacity

    await page.getByRole("button", { name: /^All \d+$/ }).click();
    await page.getByRole("searchbox", { name: "Search events" }).fill("devhack");
    await expect(page.getByRole("link", { name: /Open: DevHack 2027/ })).toBeVisible();
    await expect(page.getByText(/\d+ applications? · \d+ accepted/).locator("visible=true")).toBeVisible();
    await expect(results).toHaveText("1 result");

    await page.getByRole("searchbox", { name: "Search events" }).fill("zzzz-no-such-event");
    await expect(page.getByRole("heading", { name: "No events match" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByRole("link", { name: /Open: DevHack 2027/ })).toBeVisible();
  });

  test("empty, loading and error states", async ({ page }) => {
    await page.goto("/en/admin/events?state=empty");
    await expect(page.getByRole("heading", { name: "No events yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create event" })).toHaveCount(2); // header action + the one empty-state action

    await page.goto("/en/admin/events?state=slow", { waitUntil: "commit" });
    await expect(page.getByRole("status").filter({ hasText: "Loading events…" })).toBeAttached();
    await expect(page.getByRole("link", { name: /Open: DevHack 2027/ })).toBeVisible({ timeout: 20_000 });

    await page.goto("/en/admin/events?state=error");
    await expect(page.getByRole("alert").filter({ hasText: "This section didn’t load" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("Mongolian copy", async ({ page }) => {
    await page.goto("/mn/admin/events");
    await expect(page.getByRole("heading", { level: 1, name: "Эвентүүд" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Эвент үүсгэх" })).toBeVisible();
  });
});

test.describe("create and edit", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-admin"));

  test("field-level errors, focus on the first error, slug conflict message", async ({ page }) => {
    await page.goto("/en/admin/events/new");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("Fix 2 fields")).toBeVisible();
    await expect(page.getByText("Required", { exact: true }).first()).toBeVisible();
    await expect(page.locator('input[name="title.mn"]:visible')).toBeFocused();

    // slug auto-suggested from the English title, and a taken slug is explained next to the field
    await page.locator('input[name="title.mn"]:visible').fill("Тест");
    await page.locator('input[name="title.en"]:visible').fill("DevHack 2027");
    await expect(page.locator('input[name="slug"]:visible')).toHaveValue("devhack-2027");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("Another event already uses this slug")).toBeVisible();

    await page.locator('input[name="slug"]:visible').fill("x");
    await expect(page.getByText("3–60 characters: lowercase letters, numbers and dashes")).toBeVisible();
  });

  test("conditional fields: online link, application settings, question builder rules", async ({ page }) => {
    await page.goto("/en/admin/events/new");
    await expect(page.locator('input[name="venue_name"]:visible')).toBeVisible();
    await expect(page.locator('input[name="online_url"]:visible')).toHaveCount(0);
    await page.locator("label").filter({ hasText: /^Online$/ }).click();
    await expect(page.locator('input[name="venue_name"]:visible')).toHaveCount(0);
    await page.locator('input[name="online_url"]:visible').fill("http://insecure.example.com");
    await page.locator('input[name="title.mn"]:visible').fill("Онлайн");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("Enter a link that starts with https://")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Application questions" })).toHaveCount(0);
    await page.locator("label").filter({ hasText: /^Application/ }).click();
    await expect(page.getByRole("heading", { name: "Application questions" })).toBeVisible();
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: "Add question" }).click();
    await expect(page.getByRole("heading", { name: "Question 2" })).toBeVisible();
    await page.getByRole("button", { name: "Move up" }).nth(1).click(); // reorder: second becomes first
    await page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Question 1" }) }).getByRole("combobox", { name: "Type" }).selectOption("select");
    await expect(page.getByRole("group", { name: "Options" })).toBeVisible();
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText("Fill in at least 2 options")).toBeVisible();
    await page.getByRole("button", { name: "Remove question" }).first().click();
    await expect(page.getByRole("heading", { name: "Question 2" })).toHaveCount(0);
  });

  test("create draft → header, tabs, empty registrations / analytics / comms → publish → cancel", async ({ page }) => {
    const title = `E2E Draft ${stamp()}`;
    const id = await createDraft(page, title);
    await expect(page.getByRole("status").filter({ hasText: "Event created" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to draft" })).toHaveCount(0);

    await page.getByRole("link", { name: /^Registrations/ }).click();
    await expect(page.getByRole("heading", { name: "No registrations yet" })).toBeVisible();
    await page.getByRole("link", { name: /^Analytics/ }).click();
    await expect(page.getByRole("heading", { name: "Nothing to chart yet" })).toBeVisible();
    await page.locator('a[href*="/admin/events/"][href$="/comms"]').click(); // the event tab, not the sidebar item
    await expect(page.getByRole("heading", { name: "No emails for this event yet" })).toBeVisible();

    // publish via a dialog that names the event
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`Publish “${title}”?`);
    await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark completed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to draft" })).toBeVisible(); // nobody registered yet

    // an edit that moves the venue of a published event with nobody going saves without a review dialog
    await page.getByRole("link", { name: "Overview" }).click();
    await page.locator('input[name="venue_name"]:visible').fill("Room 42");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Cancel event" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`Cancel “${title}”?`);
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel event" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Cancelled" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
    expect(id).toMatch(/^e_\d+$/);
  });

  test("staged edit: a published event with people going shows before/after and the head count, and Cancel changes nothing", async ({ page }) => {
    const id = await eventId(page, "Knowledge Day: Building RAG Systems");
    await page.goto(`/en/admin/events/${id}`);
    const venue = page.locator('input[name="venue_name"]:visible');
    const before = await venue.inputValue();
    await venue.fill(`${before} (moved)`);
    await page.getByRole("button", { name: "Save changes" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(/\d+ people will get an updated invite/);
    await expect(dialog).toContainText("Before");
    await expect(dialog).toContainText("After");
    await expect(dialog).toContainText(`${before} (moved)`);
    await expect(dialog).toContainText("People are notified");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.reload();
    await expect(page.locator('input[name="venue_name"]:visible')).toHaveValue(before);
  });

  test("a title-only change on a published event does not open the review", async ({ page }) => {
    const title = `E2E Pub ${stamp()}`;
    await createDraft(page, title);
    await page.getByRole("button", { name: "Publish" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Mark completed" })).toBeVisible();
    await page.getByRole("link", { name: "Overview" }).click();
    await page.locator('input[name="tagline.mn"]:visible').fill("Шинэ уриа үг");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  });
});

test.describe("registrations", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-admin"));

  test("at a glance, segments with counts, filters, search, drawer without email, selection bar", async ({ page }) => {
    const id = await eventId(page, "DevHack 2027");
    await page.goto(`/en/admin/events/${id}/registrations`);
    await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
    await expect(page.getByRole("meter").first()).toBeVisible(); // seats taken vs capacity

    const applied = page.getByRole("button", { name: /^Applied \d+$/ });
    await expect(applied).toBeVisible();
    await applied.click();
    await expect(applied).toHaveAttribute("aria-pressed", "true");
    const results = page.getByRole("status").filter({ hasText: /\d+ results?/ });
    const n = Number((await results.innerText()).match(/\d+/)![0]);
    expect(n).toBeGreaterThan(10);

    // per-question answer chips narrow the list
    await page.getByRole("group", { name: "Hackathon experience" }).getByRole("button", { name: /^Beginner/ }).click();
    const narrowed = Number((await results.innerText()).match(/\d+/)![0]);
    expect(narrowed).toBeLessThan(n);
    await page.getByRole("group", { name: "Hackathon experience" }).getByRole("button", { name: /^Beginner/ }).click();

    await page.getByRole("button", { name: "Solo" }).click();
    expect(Number((await results.innerText()).match(/\d+/)![0])).toBeLessThan(n);
    await page.getByRole("button", { name: "Solo" }).click();

    await page.getByRole("searchbox", { name: "Search registrations" }).fill("zzzz-nobody");
    await expect(page.getByRole("heading", { name: "No registrations match" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();

    // drawer: all answers + profile summary, never an email address
    await page.getByRole("button", { name: /: details$/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: "Answers" })).toBeVisible();
    await expect(drawer.getByText("Hackathon experience")).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Profile" })).toBeVisible();
    expect(await drawer.innerText()).not.toMatch(/@/);
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);

    // selection shows the bar with the capacity line; Clear removes it
    const boxes = page.getByRole("checkbox", { name: "Select row" });
    await boxes.nth(0).check();
    await boxes.nth(1).check();
    const bar = page.getByRole("group", { name: "Actions for the selected registrations" });
    await expect(bar).toContainText("2 selected");
    await expect(bar).toContainText(/Seats 2 · \d+ left after/);
    await expect(bar.getByRole("button", { name: "Accept" })).toBeEnabled();
    await bar.getByRole("button", { name: "Clear selection" }).click();
    await expect(bar).toHaveCount(0);
  });

  test("decisions: waitlist one application, then the send dialog states the counts and cancelling sends nothing", async ({ page }) => {
    const id = await eventId(page, "DevHack 2027");
    await page.goto(`/en/admin/events/${id}/registrations`);
    await page.getByRole("button", { name: /^Applied \d+$/ }).click();
    const waitingBefore = await page.getByText(/decisions? waiting to be sent|No decisions waiting/).innerText();
    await page.getByRole("checkbox", { name: "Select row" }).first().check();
    await page.getByRole("group", { name: "Actions for the selected registrations" }).getByRole("button", { name: "Waitlist" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Waitlisted 1 person" })).toBeVisible();
    await expect(page.getByText(/decisions? waiting to be sent/)).not.toHaveText(waitingBefore);

    const send = page.getByRole("button", { name: "Send decisions" });
    await expect(send).toBeEnabled();
    await send.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(/Send \d+ decisions/);
    await expect(dialog).toContainText(/\d+ accepted · \d+ rejected · \d+ waitlisted/);
    await expect(dialog).toContainText("Nobody has been told before this");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("team view: cards with members, captain, size, and team-level actions", async ({ page }) => {
    const id = await eventId(page, "DevHack 2027");
    await page.goto(`/en/admin/events/${id}/registrations`);
    await page.getByRole("button", { name: "Teams", exact: true }).click();
    await expect(page.getByText(/\d+ teams?/).first()).toBeVisible();
    await expect(page.getByText(/\d+ \/ 4 members/).first()).toBeVisible();
    await expect(page.getByText("Captain").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept team" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Reject team" }).first()).toBeVisible();
    await page.getByRole("button", { name: /^Applied solo/ }).click();
    await expect(page.getByRole("searchbox", { name: "Search registrations" })).toBeVisible();
  });

  test("RSVP event: no decision bar, no teams", async ({ page }) => {
    const id = await eventId(page, "Knowledge Day: Building RAG Systems");
    await page.goto(`/en/admin/events/${id}/registrations`);
    await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send decisions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Teams", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Applied \d+$/ })).toHaveCount(0);
  });

  test("CSV export: staff only, BOM, filename, one column per question in the active language", async ({ page }) => {
    const id = await eventId(page, "DevHack 2027");
    const res = await page.request.get(`/en/admin/events/${id}/registrations/export`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(res.headers()["content-disposition"]).toBe('attachment; filename="devhack-2027-registrations.csv"');
    const bytes = await res.body();
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const text = bytes.toString("utf8").slice(1);
    const [header, ...lines] = text.split("\r\n").filter(Boolean);
    expect(header).toBe("Name,School,Status,Team,Applied,Your main skills,Hackathon experience,GitHub or portfolio link");
    expect(lines.length).toBeGreaterThan(50);
    expect(text).not.toMatch(/@example\.com/);
    const mn = await page.request.get(`/mn/admin/events/${id}/registrations/export`);
    expect((await mn.text()).split("\r\n")[0]).toContain("Таны гол ур чадвар");
  });
});

test.describe("analytics and comms", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-admin"));

  test("analytics: KPIs, funnel, split, by school, per day", async ({ page }) => {
    const id = await eventId(page, "Knowledge Day: Building RAG Systems");
    await page.goto(`/en/admin/events/${id}/analytics`);
    await expect(page.getByText("Registered", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "From registration to attendance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "By school" })).toBeVisible();
    await expect(page.getByText(/registrations in the last 30 days\. Busiest/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "New vs returning people" })).toBeVisible();
  });

  test("comms: rows for this event only, status filter, names but never email addresses", async ({ page }) => {
    const id = await eventId(page, "Knowledge Day: Building RAG Systems");
    await page.goto(`/en/admin/events/${id}/comms`);
    await expect(page.getByRole("heading", { name: "Emails for this event" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Recipient" })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/);
    const failed = page.getByRole("button", { name: /^Failed \d+$/ });
    await failed.click();
    await expect(failed).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/Mailbox doesn’t exist|Mail server took too long/).first()).toBeVisible();
  });
});

test.describe("responsive", () => {
  for (const width of WIDTHS) {
    test(`no horizontal page scroll at ${width}px`, async ({ page }) => {
      await signInAs(page, "dev-admin");
      await page.setViewportSize({ width, height: 900 });
      const devhack = await eventId(page, "DevHack 2027");
      for (const path of ["/en/admin/events", "/mn/admin/events", "/en/admin/events/new", `/en/admin/events/${devhack}`, `/en/admin/events/${devhack}/registrations`, `/en/admin/events/${devhack}/analytics`, `/en/admin/events/${devhack}/comms`]) {
        await page.goto(path);
        await page.locator("main h1").waitFor();
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(width);
      }
      await page.goto(`/en/admin/events/${devhack}/registrations`);
      await page.getByRole("button", { name: "Teams", exact: true }).click();
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe: no WCAG 2.2 A/AA violations on the events screens (${scheme})`, async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.emulateMedia({ colorScheme: scheme });
    const devhack = await eventId(page, "DevHack 2027");
    const paths = ["/en/admin/events", "/mn/admin/events", "/en/admin/events/new", `/en/admin/events/${devhack}`, `/en/admin/events/${devhack}/registrations`, `/en/admin/events/${devhack}/analytics`, `/en/admin/events/${devhack}/comms`];
    for (const path of paths) {
      await page.goto(path);
      await page.locator("main h1").waitFor();
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
      expect(violations.map((v) => `${path} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    }
    // interactive surfaces: teams view, row drawer, send-decisions dialog
    await page.goto(`/en/admin/events/${devhack}/registrations`);
    await page.getByRole("button", { name: "Teams", exact: true }).click();
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByRole("button", { name: /: details$/ }).first().click();
    await page.getByRole("dialog").waitFor();
    const drawer = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
    expect(drawer.violations.map((v) => `drawer ${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
