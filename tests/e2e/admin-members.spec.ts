// Members, Comms, Settings and Audit areas of the backoffice. The mock database is shared and mutable (other specs and
// the dev dispatcher run at the same time), so tests assert relative changes, skip gracefully when seed rows they would
// consume are gone, and never click "Reset demo data".
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

const ADMIN_ROUTES = ["members", "members/applications", "members/merge", "comms", "settings", "settings/staff", "settings/integrations", "audit"];
const PERSONA_HANDLES = ["dev-admin", "dev-organizer", "anuujin", "temuulen", "saraa", "new-guest"];
const url = (p: string, lang = "en") => `/${lang}/admin/${p}`;

async function open(page: Page, path: string, lang = "en") {
  await page.goto(url(path, lang));
  await page.locator("main h1").waitFor();
}
const number = async (loc: ReturnType<Page["locator"]>) => Number((await loc.innerText()).replace(/\D/g, ""));
const NOT_FOUND = /coffee not found/;

test.describe("access", () => {
  test("an admin can open every page in the four areas", async ({ page }) => {
    await signInAs(page, "dev-admin");
    const titles: Record<string, string> = { members: "Members", comms: "Comms", settings: "Settings", audit: "Audit log" };
    for (const r of ADMIN_ROUTES) {
      await open(page, r);
      await expect(page.locator("main h1")).toHaveText(titles[r.split("/")[0]!]!);
    }
  });

  test("an organizer can use Members, Comms and Audit but gets a 404 on every Settings page", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    for (const r of ["members", "members/applications", "comms", "audit"]) {
      await open(page, r);
      await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
    }
    for (const r of ["settings", "settings/staff", "settings/integrations"]) {
      await page.goto(url(r));
      await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toHaveCount(0);
    }
  });

  test("the Merge tab is disabled for organizers, with the reason, and a direct visit explains it", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members");
    const tab = page.locator('span[aria-disabled="true"]', { hasText: "Merge" });
    await expect(tab).toHaveAttribute("aria-disabled", "true");
    await expect(tab).toHaveAttribute("title", "Only admins can merge profiles");
    await open(page, "members/merge");
    await expect(page.getByRole("heading", { name: "Only admins can merge" })).toBeVisible();
  });

  test("members, guests and signed-out visitors get a 404", async ({ page }) => {
    for (const who of ["anuujin", "temuulen", null]) {
      await signInAs(page, who);
      for (const r of ["members", "comms", "audit", "settings"]) {
        await page.goto(url(r));
        await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
      }
    }
  });
});

test.describe("members directory", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-organizer"); await open(page, "members"); });

  test("segments carry counts and filter the table; search narrows with a result count and has an empty state", async ({ page }) => {
    const results = page.getByText(/^\d+ results?$/);
    const total = await number(results);
    expect(total).toBeGreaterThan(100);
    const guestsTab = page.getByRole("button", { name: /^Guests \d+/ });
    const guests = await number(guestsTab.locator("span"));
    await guestsTab.click();
    await expect(results).toHaveText(`${guests} results`);
    await page.getByRole("button", { name: /^All \d+/ }).click();
    await page.getByRole("searchbox", { name: "Search" }).fill("dev-admin");
    await expect(results).toHaveText("1 result");
    await page.getByRole("searchbox", { name: "Search" }).fill("zzzz-nobody-has-this-name");
    await expect(page.getByRole("heading", { name: "No one matches that search" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).first().click();
    await expect(results).toHaveText(`${total} results`);
  });

  test("season and team filters combine", async ({ page }) => {
    const results = page.getByText(/^\d+ results?$/);
    const total = await number(results);
    await page.getByRole("group", { name: "Filter by season" }).getByRole("button", { name: /^2025/ }).click();
    const bySeason = await number(results);
    expect(bySeason).toBeLessThan(total);
    await page.getByRole("group", { name: "Filter by team" }).getByRole("button", { name: "Dev" }).click();
    expect(await number(results)).toBeLessThanOrEqual(bySeason);
  });

  test("a row opens the full profile with the email, roster history and registrations", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search" }).fill("anuujin");
    await page.getByRole("button", { name: /Open .*’s profile/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Only staff see the email here")).toBeVisible();
    await expect(drawer.getByText(/@example\.(com|edu\.mn)/)).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Season history" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Event registrations" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Membership applications" })).toBeVisible();
  });

  test("bulk bar names the count and verb; promoting then restoring one guest round-trips", async ({ page }) => {
    await page.getByRole("button", { name: /^Guests \d+/ }).click();
    const rows = page.locator("tbody tr");
    const n = await rows.count();
    let handle = "";
    for (let i = 0; i < n && !handle; i++) {
      const h = (await rows.nth(i).locator("td").nth(1).innerText()).match(/@([\w-]+)/)?.[1] ?? "";
      if (h && !PERSONA_HANDLES.includes(h)) { handle = h; await rows.nth(i).getByRole("checkbox").check(); }
    }
    expect(handle).not.toBe("");
    await expect(page.getByText("1 person selected")).toBeVisible();
    // "Set guest" on a guest changes nothing and says so (the selection is cleared after any action).
    await page.getByRole("button", { name: "Set guest" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Set 1 as guest?");
    await page.getByRole("alertdialog").getByRole("button", { name: "Set guest" }).click();
    await expect(page.getByText("Everyone selected is already “Guest”, nothing to change")).toBeVisible();
    // Promote: the confirm dialog says what happens and to how many.
    await expect(page.getByText("1 person selected")).toHaveCount(0);
    await page.locator("tbody tr").filter({ hasText: `@${handle}` }).getByRole("checkbox").check();
    await page.getByRole("button", { name: "Promote to member" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Promote 1 to member?");
    await page.getByRole("alertdialog").getByRole("button", { name: "Promote to member" }).click();
    await expect(page.getByText("1 promoted to member")).toBeVisible();
    await page.getByRole("button", { name: /^Members \d+/ }).click();
    await page.getByRole("searchbox", { name: "Search" }).fill(handle);
    const row = page.locator("tbody tr").first();
    await expect(row).toContainText("Member");
    await row.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Set guest" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Set guest" }).click();
    await expect(page.getByText("1 set to guest")).toBeVisible();
  });
});

test.describe("applications", () => {
  test("cards show the applicant and the private-note promise; reject asks first; approve moves the card to its tab", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members/applications");
    const pending = page.getByRole("button", { name: /^Pending \d+/ });
    const before = await number(pending.locator("span"));
    test.skip(before === 0, "no pending applications left in the shared demo data");
    const card = page.locator("li").filter({ has: page.getByRole("button", { name: "Approve" }) }).first();
    const name = await card.locator("p").first().innerText();
    await expect(card.getByText("Why they want to join")).toBeVisible();
    await card.locator("summary").click();
    await expect(card.getByText("Only staff can see this. It is never sent to the applicant.")).toBeVisible();
    await card.getByRole("textbox").fill("Strong motivation, joins Dev.");
    // Rejecting names the person and says an email goes out, and Cancel does nothing.
    await card.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Reject ${name}’s application?`);
    await expect(dialog).toContainText("Your note is not part of the email");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(pending.locator("span")).toHaveText(String(before));
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(`${name} is now a member and will be emailed`)).toBeVisible();
    await expect(pending.locator("span")).toHaveText(String(before - 1));
    await page.getByRole("button", { name: /^Approved \d+/ }).click();
    const approved = page.locator("li").filter({ hasText: name }).first();
    await expect(approved).toContainText("Strong motivation, joins Dev.");
    await expect(approved).toContainText("Reviewed by");
  });

  test("a second reviewer is told who already decided (conflict), and the card moves", async ({ browser }) => {
    const a = await browser.newContext(), b = await browser.newContext();
    const pa = await a.newPage(), pb = await b.newPage();
    await signInAs(pa, "dev-organizer");
    await signInAs(pb, "dev-admin");
    // Page A loses its live connection, so its card is stale by the time it clicks.
    await pa.route("**/api/dev/stream", (r) => r.abort());
    await open(pa, "members/applications");
    const pendingBefore = await number(pa.getByRole("button", { name: /^Pending \d+/ }).locator("span"));
    test.skip(pendingBefore === 0, "no pending applications left in the shared demo data");
    const name = await pa.locator("li").filter({ has: pa.getByRole("button", { name: "Approve" }) }).first().locator("p").first().innerText();
    await open(pb, "members/applications");
    await pb.locator("li").filter({ hasText: name }).getByRole("button", { name: "Approve" }).click();
    await expect(pb.getByText(`${name} is now a member`)).toBeVisible();
    await pa.locator("li").filter({ hasText: name }).getByRole("button", { name: "Approve" }).click();
    await expect(pa.getByRole("alert").filter({ hasText: /already reviewed this application/ })).toContainText("Dev Admin");
    await a.close(); await b.close();
  });

  test("the empty state for a tab with no applications offers context, not a blank page", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members/applications");
    // The Rejected tab may or may not be empty; either way the tab renders a list or an empty state, never nothing.
    await page.getByRole("button", { name: /^Rejected \d+/ }).click();
    await expect(page.locator("main li, main h3").first()).toBeVisible();
  });
});

test.describe("merge", () => {
  test("lists possible duplicates, compares both profiles, confirms by name, and merges", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "members/merge");
    const pairs = page.getByText(/^\d+ pairs?$/);
    const before = await number(pairs);
    test.skip(before === 0, "no duplicate pairs left in the shared demo data");
    await page.getByRole("button", { name: "Compare" }).first().click();
    const compare = page.getByRole("region", { name: "Compare the two profiles" });
    await expect(compare.getByRole("radio", { name: "Keep this one" })).toHaveCount(2);
    await expect(compare.getByText("Event registrations")).toHaveCount(2);
    await expect(compare.getByText("Sign-in account")).toHaveCount(2);
    // Choosing the other profile flips which one is kept (and the dialog title follows).
    await compare.getByRole("button", { name: "Merge" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(/Merge .+ into .+/);
    await expect(dialog).toContainText("This can’t be undone");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await compare.getByRole("radio", { name: "Keep this one" }).nth(1).check();
    await compare.getByRole("button", { name: "Merge" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(/Merge .+ into .+/);
    await page.getByRole("alertdialog").getByRole("button", { name: "Merge", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Merged .+ into .+/ })).toBeVisible();
    await expect.poll(() => number(pairs)).toBeLessThan(before);
  });

  test("the manual picker compares two chosen profiles and rejects choosing the same one twice", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "members/merge");
    const first = page.getByRole("combobox", { name: "First profile" });
    const second = page.getByRole("combobox", { name: "Second profile" });
    await page.getByRole("searchbox", { name: /First profile/ }).fill("dev-admin");
    await first.selectOption({ label: "Dev Admin · @dev-admin" });
    await page.getByRole("searchbox", { name: /Second profile/ }).fill("dev-admin");
    await second.selectOption({ label: "Dev Admin · @dev-admin" });
    await expect(page.getByText("Choose two different profiles.")).toBeVisible();
    await page.getByRole("searchbox", { name: /Second profile/ }).fill("dev-organizer");
    await second.selectOption({ label: "Dev Organizer · @dev-organizer" });
    await expect(page.getByRole("region", { name: "Compare the two profiles" })).toBeVisible();
  });
});

test.describe("comms", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-organizer"); });

  test("budget meter shows sent / 100 with the 20 reserved for transactional; KPIs are present", async ({ page }) => {
    await open(page, "comms");
    const meter = page.getByRole("meter", { name: /emails sent today, daily limit 100/ });
    await expect(meter).toHaveAttribute("aria-valuemax", "100");
    await expect(page.getByText("20 reserved for transactional")).toBeVisible();
    for (const k of ["Queued", "Failed", "Skipped"]) await expect(page.getByText(k, { exact: true }).first()).toBeVisible();
  });

  test("status tabs carry counts and ?status=failed (the dashboard link) selects Failed", async ({ page }) => {
    await open(page, "comms?status=failed");
    const tab = page.getByRole("link", { name: /^Failed \d+/ });
    await expect(tab).toHaveAttribute("aria-current", "page");
    const failed = await number(tab.locator("span"));
    const pills = page.locator("tbody tr");
    await expect(pills).toHaveCount(failed);
    for (const t of await page.locator("tbody tr td:nth-child(3)").allInnerTexts()) expect(t).toContain("Failed");
    await expect(page.getByText(`${failed} result${failed === 1 ? "" : "s"}`, { exact: true })).toBeVisible();
  });

  test("a template filter narrows the list and lives in the URL", async ({ page }) => {
    await open(page, "comms");
    await page.getByRole("group", { name: "Filter by template" }).getByRole("button", { name: /^Welcome/ }).click();
    await expect(page).toHaveURL(/template=welcome/);
    for (const t of await page.locator("tbody tr td:nth-child(1)").allInnerTexts()) expect(t).toContain("Welcome");
  });

  test("lists never print email addresses", async ({ page }) => {
    await open(page, "comms");
    expect(await page.locator("table").innerText()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test("Preview renders subject, a sandboxed iframe, plain text and the calendar invite", async ({ page }) => {
    await open(page, "comms");
    await page.getByRole("button", { name: /^Preview: RSVP confirmed/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByTestId("preview-subject")).not.toBeEmpty();
    const frame = drawer.locator("iframe");
    await expect(frame).toHaveAttribute("sandbox", "");
    await expect(frame).toHaveAttribute("title", "Email preview");
    await expect(frame).toHaveAttribute("srcdoc", /<html/);
    await drawer.getByLabel("Preview language").selectOption("en"); // the drawer opens in the recipient's language
    await drawer.getByRole("tab", { name: "Plain text" }).click();
    await expect(drawer.locator("pre")).toContainText("Notification settings");
    await drawer.getByRole("tab", { name: "Calendar invite" }).click();
    await expect(drawer.getByText(/Invite or update|This email doesn’t carry a calendar invite/)).toBeVisible();
    await drawer.getByLabel("Preview language").selectOption("mn");
    await expect(drawer.getByTestId("preview-subject")).toContainText(/[А-Яа-яӨөҮү]/); // Mongolian subject
  });

  test("Send queued now runs one dispatcher beat and reports the outcome", async ({ page }) => {
    await open(page, "comms");
    await page.getByRole("button", { name: "Send queued now" }).click();
    await expect(page.getByTestId("send-result")).toHaveText(/Sent \d+ · skipped \d+ · failed \d+|Nothing to send/);
  });

  test("Retry puts a failed email back in the queue", async ({ page }) => {
    await open(page, "comms?status=failed");
    const retry = page.getByRole("button", { name: /^Retry:/ });
    const n = await retry.count();
    test.skip(n === 0, "no failed emails left in the shared demo data");
    await retry.first().click();
    await expect(page.getByText("Put the email back in the queue")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Retry:/ })).toHaveCount(n - 1);
  });

  test("an empty status shows an empty state with a way back", async ({ page }) => {
    await open(page, "comms?status=sent&template=announcement");
    await expect(page.getByRole("heading", { name: "No emails in this state" })).toBeVisible();
    await page.getByRole("link", { name: "Show all emails" }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-admin"); });

  test("seasons: current season and whether applications are open are visible", async ({ page }) => {
    await open(page, "settings");
    await expect(page.getByText("Current season", { exact: true })).toBeVisible();
    await expect(page.locator("tbody tr").filter({ hasText: "Current" })).toHaveCount(1);
    await expect(page.getByText(/Open for .+ · closes|Opens for .+ on|Not accepting applications right now/)).toBeVisible();
  });

  test("season form validates next to the field, then creates and edits a season", async ({ page }) => {
    await open(page, "settings");
    await page.getByRole("button", { name: "Add season" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel(/^Year/).fill("1999");
    await drawer.getByLabel(/Season name · Монгол/).fill("");
    await drawer.getByLabel(/^Applications open/).fill("2090-02-01T10:00");
    await drawer.getByLabel(/^Applications close/).fill("2090-01-01T10:00");
    await drawer.getByRole("button", { name: "Save" }).click();
    await expect(drawer.getByText("Year must be a whole number from 2000 to 2100.")).toBeVisible();
    await expect(drawer.getByText("Enter the Mongolian name.")).toBeVisible();
    await expect(drawer.getByText("Applications must open before they close.")).toBeVisible();
    await expect(drawer.getByLabel(/^Year/)).toBeFocused(); // focus moves to the first error
    const year = 2060 + Math.floor(Math.random() * 40);
    await drawer.getByLabel(/^Year/).fill(String(year));
    await drawer.getByLabel(/Season name · Монгол/).fill(`${year} оны улирал`);
    await drawer.getByLabel(/^Applications close/).fill("2090-03-01T10:00");
    await drawer.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${year} оны улирал saved` })).toBeVisible();
    const row = page.locator("tbody tr").filter({ hasText: String(year) });
    await expect(row).toContainText("Scheduled");
    await row.getByRole("button", { name: /^Edit/ }).click();
    await expect(page.getByRole("dialog").getByLabel(/^Year/)).toBeDisabled();
    await page.getByRole("dialog").getByLabel(/Season name · English/).fill(`Season ${year}`);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: /saved$/ })).toBeVisible();
  });

  test("staff: roles are listed; your own admin role can't be removed; grant then remove an organizer", async ({ page }) => {
    await open(page, "settings/staff");
    const me = page.locator("tbody tr").filter({ hasText: "Dev Admin" });
    await expect(me).toContainText("Admin");
    await expect(me).toContainText("You");
    await me.getByRole("button", { name: /^Remove access/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove access" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "You can’t remove the last admin or your own admin role." })).toBeVisible();
    // Demoting yourself is the same loss of access and is refused the same way.
    await me.getByRole("button", { name: /Make organizer/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Make organizer" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "You can’t remove the last admin or your own admin role." })).toBeVisible();

    await page.getByRole("searchbox", { name: /^Person/ }).fill("-2");
    const select = page.getByRole("combobox", { name: "Person" });
    const label = (await select.locator("option").nth(1).innerText()).split(" · ")[0]!;
    await select.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Grant role" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`Make ${label} an organizer?`);
    await page.getByRole("alertdialog").getByRole("button", { name: "Grant role" }).click();
    const added = page.locator("tbody tr").filter({ hasText: label });
    await expect(added).toContainText("Organizer");
    await added.getByRole("button", { name: /^Remove access/ }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`Remove ${label}’s staff access?`);
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove access" }).click();
    await expect(page.locator("tbody tr").filter({ hasText: label })).toHaveCount(0);
  });

  test("integrations: five honest 'Local demo: simulated' cards, env var names, the state legend, and a reset button (not clicked)", async ({ page }) => {
    await open(page, "settings/integrations");
    for (const n of ["Clerk", "Supabase", "Resend", "Scheduled jobs", "Live updates"]) await expect(page.getByRole("heading", { name: n, exact: true })).toBeVisible();
    await expect(page.getByText("Local demo: simulated")).toHaveCount(5);
    for (const v of ["CLERK_SECRET_KEY", "RESEND_API_KEY", "CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL"]) await expect(page.getByText(v, { exact: true }).first()).toBeVisible();
    for (const s of ["Connected", "Misconfigured", "Failing"]) await expect(page.getByText(s, { exact: true })).toBeVisible();
    await expect(page.getByTestId("reset-demo")).toBeEnabled(); // deliberately NOT clicked: it would reset every other spec's data
  });
});

test.describe("audit", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-organizer"); });

  test("newest first, plain-language actions, and a result count", async ({ page }) => {
    await open(page, "audit");
    await expect(page.getByText(/^\d+ results?$/)).toBeVisible();
    const times = await page.locator("tbody time").evaluateAll((els) => els.map((e) => Date.parse(e.getAttribute("datetime") ?? "")));
    expect(times.length).toBeGreaterThan(5);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(await page.locator("tbody").innerText()).not.toMatch(/\b(event\.update|registration\.decide|membership\.approve)\b/);
  });

  test("action-group, actor and range filters narrow server-side and live in the URL", async ({ page }) => {
    await open(page, "audit");
    const results = page.getByText(/^\d+ results?$/);
    const all = await number(results);
    await page.getByRole("group", { name: "Filter by kind of action" }).getByRole("button", { name: "Members" }).click();
    await expect(page).toHaveURL(/group=members/);
    await expect.poll(() => number(results)).toBeLessThan(all);
    for (const t of await page.locator("tbody tr td:nth-child(2)").allInnerTexts()) expect(t).toMatch(/member|profile/i);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect.poll(() => number(results)).toBe(all);
    await page.getByRole("group", { name: "Time range" }).getByRole("button", { name: "Last 24 hours" }).click();
    await expect(page).toHaveURL(/range=24h/);
    await expect.poll(() => number(results)).toBeLessThanOrEqual(all);
    await page.getByRole("combobox", { name: "Who did it" }).selectOption({ label: "Dev Admin" });
    await expect(page).toHaveURL(/actor=/);
  });

  test("a filter with no matches shows the empty state; junk params and out-of-range pages are tolerated", async ({ page }) => {
    await open(page, "audit?actor=nobody-with-this-id");
    await expect(page.getByRole("heading", { name: "Nothing found" })).toBeVisible();
    await open(page, "audit?group=%3Cscript%3E&range=forever&page=-7");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await open(page, "audit?page=999");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("a row opens the diff as readable before → after pairs", async ({ page }) => {
    await open(page, "audit");
    await page.getByRole("button", { name: /^Changed event details/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: "Changes" })).toBeVisible();
    await expect(drawer.getByText("Before:")).toHaveCount(await drawer.getByText("After:").count());
    expect(await drawer.getByText("After:").count()).toBeGreaterThan(0);
  });
});

test.describe("states", () => {
  test("every area shows its loading skeleton, then content (?state=slow)", async ({ page }) => {
    await signInAs(page, "dev-admin");
    for (const r of ["members", "comms", "settings", "audit"]) {
      await page.goto(url(`${r}?state=slow`), { waitUntil: "commit" });
      await expect(page.getByRole("status").filter({ hasText: /Loading/ }).first()).toBeVisible();
      await expect(page.locator("main table, main ul, main section").first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test("every area shows a recovery action when it fails (?state=error)", async ({ page }) => {
    await signInAs(page, "dev-admin");
    for (const r of ["members", "comms", "settings", "audit"]) {
      await page.goto(url(`${r}?state=error`));
      const err = page.getByTestId("area-error");
      await expect(err).toBeVisible();
      await expect(err.getByRole("button", { name: "Try again" })).toBeVisible();
    }
  });

  test("Mongolian renders in each area", async ({ page }) => {
    await signInAs(page, "dev-admin");
    const titles: Record<string, string> = { members: "Гишүүд", comms: "Мэдэгдэл", settings: "Тохиргоо", audit: "Түүх" };
    for (const [r, title] of Object.entries(titles)) {
      await open(page, r, "mn");
      await expect(page.locator("main h1")).toHaveText(title);
    }
  });
});

test.describe("layout", () => {
  for (const width of [360, 768, 1280]) {
    test(`no horizontal page scroll at ${width}px on every page`, async ({ page }) => {
      await signInAs(page, "dev-admin");
      await page.setViewportSize({ width, height: 900 });
      for (const r of ADMIN_ROUTES) {
        await open(page, r);
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.documentElement.scrollWidth), r).toBeLessThanOrEqual(width);
      }
    });
  }
});

test.describe("accessibility", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no WCAG 2.2 A/AA violations on all pages (${scheme})`, async ({ page }) => {
      test.setTimeout(240_000);
      await signInAs(page, "dev-admin");
      await page.emulateMedia({ colorScheme: scheme });
      for (const r of ADMIN_ROUTES) {
        await open(page, r);
        await page.waitForLoadState("networkidle");
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
        expect(violations.map((v) => `${r} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      }
    });

    test(`axe: open drawers and dialogs (${scheme})`, async ({ page }) => {
      test.setTimeout(300_000);
      await signInAs(page, "dev-admin");
      await page.emulateMedia({ colorScheme: scheme });
      const scan = async (label: string) => {
        // axe can't inject into a scripts-disabled sandboxed frame (it waits forever), so the email document inside the
        // iframe is excluded; the frame's title is asserted in the preview test instead.
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").exclude("iframe[sandbox]").analyze();
        expect(violations.map((v) => `${label} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      };
      await open(page, "members");
      await page.getByRole("button", { name: /Open .*’s profile/ }).first().click();
      await page.getByRole("dialog").waitFor();
      await scan("member drawer");
      await open(page, "comms");
      await page.getByRole("button", { name: /^Preview:/ }).first().click();
      await page.getByRole("dialog").getByTestId("preview-subject").waitFor();
      await scan("email preview");
      await open(page, "settings");
      await page.getByRole("button", { name: "Add season" }).click();
      await page.getByRole("dialog").waitFor();
      await scan("season form");
      await open(page, "audit");
      await page.getByRole("button", { name: /^Changed event details/ }).first().click();
      await page.getByRole("dialog").waitFor();
      await scan("audit diff");
    });
  }
});
