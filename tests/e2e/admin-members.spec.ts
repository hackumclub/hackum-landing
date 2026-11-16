// Members, Comms, Settings and Audit areas of the backoffice. The mock database is shared and mutable (other specs and
// the dev dispatcher run at the same time), so tests assert relative changes, skip gracefully when seed rows they would
// consume are gone, and never click "Reset demo data".
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";
import { chooseOption, setDateTime } from "./helpers/pickers";

const ADMIN_ROUTES = ["members", "members?tab=applications", "members?tab=merge", "comms", "settings", "settings/staff", "settings/integrations", "audit"];
const PERSONA_HANDLES = ["dev-admin", "dev-organizer", "anuujin", "temuulen", "saraa", "bayar", "new-guest"];
const url = (p: string, lang = "en") => `/${lang}/admin/${p}`;

async function open(page: Page, path: string, lang = "en") {
  await page.goto(url(path, lang));
  await page.locator("main h1").waitFor();
}
const number = async (loc: ReturnType<Page["locator"]>) => Number((await loc.innerText()).replace(/\D/g, ""));
/** The exact number on a tab or chip (CountBadge keeps it in its accessible name, the chip prints it). */
const badge = async (loc: ReturnType<Page["locator"]>) => Number((await loc.getAttribute("aria-label").then((l) => l ?? "")).match(/(\d+)\s*$/)?.[1] ?? (await loc.innerText()).match(/(\d+)\s*$/)![1]);
const status = (page: Page) => page.getByRole("group", { name: "Status", exact: true });
const NOT_FOUND = /coffee not found/;

test.describe("access", () => {
  test("an admin can open every page in the four areas", async ({ page }) => {
    await signInAs(page, "dev-admin");
    const titles: Record<string, string> = { members: "Members", comms: "Comms", settings: "Settings", audit: "Audit log" };
    for (const r of ADMIN_ROUTES) {
      await open(page, r);
      await expect(page.locator("main h1")).toHaveText(titles[r.split(/[/?]/)[0]!]!);
    }
  });

  test("an organizer can use Members and Comms but gets a 404 on Audit and every Settings page", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    for (const r of ["members", "members?tab=applications", "comms"]) {
      await open(page, r);
      await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
    }
    for (const r of ["audit", "settings", "settings/staff", "settings/integrations"]) {
      await page.goto(url(r));
      await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toHaveCount(0);
    }
  });

  test("an organizer who opens the Merge tab is told, with the reason, that only admins can merge", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members");
    await page.getByRole("link", { name: "Merge" }).click();
    await expect(page).toHaveURL(/tab=merge/);
    await expect(page.getByRole("heading", { name: "Only admins can merge" })).toBeVisible();
    await open(page, "members?tab=merge"); // the old URL lands on the same tab
    await expect(page.getByRole("heading", { name: "Only admins can merge" })).toBeVisible();
  });

  test("members and guests get a 404; signed-out visitors are sent to sign in", async ({ page }) => {
    for (const who of ["anuujin", "temuulen"]) {
      await signInAs(page, who);
      for (const r of ["members", "comms", "audit", "settings"]) {
        await page.goto(url(r));
        await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
      }
    }
    await signInAs(page, null);
    await page.goto(url("members"));
    await expect(page).toHaveURL(/\/en\/sign-in\?next=/);
  });
});

test.describe("members directory", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-organizer"); await open(page, "members"); });

  test("status chips carry counts and filter the table; search narrows with a result count and has an empty state", async ({ page }) => {
    const results = page.getByText(/^\d+ results?$/);
    const total = await number(results);
    expect(total).toBeGreaterThan(100);
    const guestsChip = status(page).getByRole("button", { name: /^Guest \d+/ });
    const guests = await number(guestsChip.getByRole("img"));
    await guestsChip.click();
    await expect(results).toHaveText(`${guests} results`);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("searchbox", { name: "Search" }).fill("dev-admin");
    await expect(results).toHaveText("1 result");
    await page.getByRole("searchbox", { name: "Search" }).fill("zzzz-nobody-has-this-name");
    await expect(page.getByRole("heading", { name: "No results match" })).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Clear filters" }).first().click();
    await expect(results).toHaveText(`${total} results`);
  });

  test("season and team filters combine", async ({ page }) => {
    const results = page.getByText(/^\d+ results?$/);
    const total = await number(results);
    await page.getByRole("group", { name: "Year", exact: true }).getByRole("button", { name: /^2025/ }).click();
    await expect.poll(() => number(results)).toBeLessThan(total);
    const bySeason = await number(results);
    await page.getByRole("group", { name: "Team", exact: true }).getByRole("button", { name: /^Dev/ }).click();
    expect(await number(results)).toBeLessThanOrEqual(bySeason);
  });

  test("a row opens the full profile with the email, roster history and registrations", async ({ page }) => {
    await page.getByRole("searchbox", { name: "Search" }).fill("anuujin");
    await expect(page.getByText(/^\d+ results?$/)).toHaveText("1 result"); // the search is debounced
    await page.getByRole("button", { name: /Open .*’s profile/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Only staff see the email here")).toBeVisible();
    await expect(drawer.getByText(/@example\.(com|edu\.mn)/)).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Season history" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Event registrations" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Membership applications" })).toBeVisible();
  });

  test("bulk bar names the count and verb; promoting then restoring one guest round-trips", async ({ page }) => {
    await status(page).getByRole("button", { name: /^Guest \d+/ }).click();
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
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page.getByRole("searchbox", { name: "Search" }).fill(handle);
    // The search is debounced and wait for the filtered row (slow under load) instead of asserting a global result count.
    const row = page.locator("tbody tr").filter({ hasText: `@${handle}` });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
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
    await open(page, "members?tab=applications");
    const pending = page.getByRole("tab", { name: /^Pending \d+/ });
    const before = await badge(pending.locator('[role="img"]'));
    test.skip(before === 0, "no pending applications left in the shared demo data");
    const card = page.locator("li").filter({ has: page.locator("button:enabled", { hasText: "Approve" }) }).first(); // a NUM applicant: others cannot be approved
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
    await expect.poll(() => badge(pending.locator('[role="img"]'))).toBe(before);
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText(`${name} is now a member and will be emailed`)).toBeVisible();
    await expect.poll(() => badge(pending.locator('[role="img"]'))).toBe(before - 1);
    await page.getByRole("tab", { name: /^Approved \d+/ }).click();
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
    await open(pa, "members?tab=applications");
    const pendingBefore = await badge(pa.getByRole("tab", { name: /^Pending \d+/ }).locator('[role="img"]'));
    test.skip(pendingBefore === 0, "no pending applications left in the shared demo data");
    const name = await pa.locator("li").filter({ has: pa.locator("button:enabled", { hasText: "Approve" }) }).first().locator("p").first().innerText();
    await open(pb, "members?tab=applications");
    await pb.locator("li").filter({ hasText: name }).getByRole("button", { name: "Approve" }).click();
    await expect(pb.getByText(`${name} is now a member`)).toBeVisible();
    await pa.locator("li").filter({ hasText: name }).getByRole("button", { name: "Approve" }).click();
    await expect(pa.getByRole("alert").filter({ hasText: /already reviewed this application/ })).toContainText("Dev Admin");
    await a.close(); await b.close();
  });

  test("the empty state for a tab with no applications offers context, not a blank page", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members?tab=applications");
    // The Rejected tab may or may not be empty; either way the tab renders a list or an empty state, never nothing.
    await page.getByRole("tab", { name: /^Rejected \d+/ }).click();
    await expect(page.locator("main li, main h3").first()).toBeVisible();
  });
});

test.describe("merge", () => {
  test("lists possible duplicates, compares both profiles, confirms by name, and merges", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "members?tab=merge");
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
    await open(page, "members?tab=merge");
    const first = page.getByRole("combobox", { name: "First profile" });
    const second = page.getByRole("combobox", { name: "Second profile" });
    await page.getByRole("searchbox", { name: /First profile/ }).fill("dev-admin");
    await chooseOption(page, first, "Dev Admin · @dev-admin");
    await page.getByRole("searchbox", { name: /Second profile/ }).fill("dev-admin");
    await chooseOption(page, second, "Dev Admin · @dev-admin");
    await expect(page.getByText("Choose two different profiles.")).toBeVisible();
    await page.getByRole("searchbox", { name: /Second profile/ }).fill("dev-organizer");
    await chooseOption(page, second, "Dev Organizer · @dev-organizer");
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

  test("status chips carry counts and ?status=failed (the dashboard link) selects Failed", async ({ page }) => {
    await open(page, "comms?status=failed");
    const tab = status(page).getByRole("button", { name: /^Failed \d+/ });
    await expect(tab).toHaveAttribute("aria-pressed", "true");
    const failed = await number(tab.getByRole("img"));
    const pills = page.locator("tbody tr");
    await expect(pills).toHaveCount(failed);
    for (const t of await page.locator("tbody tr td:nth-child(3)").allInnerTexts()) expect(t).toContain("Failed");
    await expect(page.getByText(`${failed} result${failed === 1 ? "" : "s"}`, { exact: true })).toBeVisible();
  });

  test("a template filter narrows the list and lives in the URL", async ({ page }) => {
    await open(page, "comms");
    await page.getByRole("group", { name: "Template", exact: true }).getByRole("button", { name: /^Welcome/ }).click();
    await expect(page).toHaveURL(/template=welcome/);
    await expect(page.locator("tbody tr td:nth-child(1)").first()).toContainText("Welcome");
    for (const t of await page.locator("tbody tr td:nth-child(1)").allInnerTexts()) expect(t).toContain("Welcome");
  });

  test("lists never print email addresses", async ({ page }) => {
    await open(page, "comms");
    expect(await page.locator("table").innerText()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test("Preview renders subject, a sandboxed iframe, plain text and the calendar invite", async ({ page }) => {
    await open(page, "comms?template=rsvp_confirmed"); // the first page of the unfiltered list is all reminders once the queue grows
    await page.getByRole("button", { name: /^Preview: RSVP confirmed/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByTestId("preview-subject")).not.toBeEmpty();
    const frame = drawer.locator("iframe");
    await expect(frame).toHaveAttribute("sandbox", "");
    await expect(frame).toHaveAttribute("title", "Email preview");
    await expect(frame).toHaveAttribute("srcdoc", /<html/);
    await drawer.getByRole("radio", { name: "English" }).check({ force: true }); // the drawer opens in the recipient's language
    await drawer.getByRole("tab", { name: "Plain text" }).click();
    await expect(drawer.locator("pre")).toContainText("Notification settings");
    await drawer.getByRole("tab", { name: "Calendar invite" }).click();
    await expect(drawer.getByText(/Invite or update|This email doesn’t carry a calendar invite/)).toBeVisible();
    await drawer.getByRole("radio", { name: "Монгол" }).check({ force: true });
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
    await page.getByRole("main").getByRole("button", { name: "Clear filters" }).first().click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });
});

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-admin"); });

  test("seasons: current season and whether applications are open are visible", async ({ page }) => {
    await open(page, "settings");
    await expect(page.getByText("Current season", { exact: true })).toBeVisible();
    await expect(page.getByTestId("season-item").filter({ hasText: "Current" })).toHaveCount(1);
    await expect(page.getByText(/Open for .+ · closes|Opens for .+ on|Not accepting applications right now/)).toBeVisible();
  });

  test("season form validates next to the field, then creates and edits a season", async ({ page }) => {
    await open(page, "settings");
    await page.getByRole("button", { name: "Add season" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByLabel(/^Year/).fill("1999");
    await drawer.getByLabel(/Season name · Монгол/).fill("");
    await setDateTime(page, drawer, "Applications open", "2090-02-01T10:00");
    await setDateTime(page, drawer, "Applications close", "2090-01-01T10:00");
    await drawer.getByRole("button", { name: "Save" }).click();
    await expect(drawer.getByText("Year must be a whole number from 2000 to 2100.")).toBeVisible();
    await expect(drawer.getByText("Enter the Mongolian name.")).toBeVisible();
    await expect(drawer.getByText("Applications must open before they close.")).toBeVisible();
    await expect(drawer.getByLabel(/^Year/)).toBeFocused(); // focus moves to the first error
    const year = 2060 + Math.floor(Math.random() * 40);
    await drawer.getByLabel(/^Year/).fill(String(year));
    await drawer.getByLabel(/Season name · Монгол/).fill(`${year} оны улирал`);
    await setDateTime(page, drawer, "Applications close", "2090-03-01T10:00");
    await drawer.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: `${year} оны улирал saved` })).toBeVisible();
    const row = page.getByTestId("season-item").filter({ hasText: String(year) });
    await expect(row).toContainText("Scheduled");
    await row.getByRole("button", { name: /^Edit/ }).click();
    await expect(page.getByRole("dialog").getByLabel(/^Year/)).toBeDisabled();
    await page.getByRole("dialog").getByLabel(/Season name · English/).fill(`Season ${year}`);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: /saved$/ })).toBeVisible();
  });

  test("staff: roles are listed; your own admin role can't be removed; grant then remove an organizer", async ({ page }) => {
    await open(page, "settings/staff");
    const me = page.getByTestId("staff-item").filter({ hasText: "Dev Admin" });
    await expect(me).toContainText("Admin");
    await expect(me).toContainText("You");
    // Your own row cannot be demoted or removed: both buttons are disabled and the reason is on screen (F-18).
    await expect(me.getByRole("button", { name: /^Remove access/ })).toBeDisabled();
    await expect(me.getByRole("button", { name: /Make organizer/ })).toBeDisabled();
    await expect(me.getByText(/your own|last admin/i).first()).toBeVisible();

    await page.getByRole("searchbox", { name: /^Person/ }).fill("-2");
    const select = page.getByRole("combobox", { name: "Person" });
    await select.click();
    const label = (await page.getByRole("listbox").getByRole("option").nth(1).innerText()).split(" · ")[0]!;
    await page.getByRole("listbox").getByRole("option").nth(1).click();
    await page.getByRole("button", { name: "Grant role" }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`Make ${label} an organizer?`);
    await page.getByRole("alertdialog").getByRole("button", { name: "Grant role" }).click();
    const added = page.getByTestId("staff-item").filter({ hasText: label });
    await expect(added).toContainText("Organizer");
    await added.getByRole("button", { name: /^Remove access/ }).click();
    await expect(page.getByRole("alertdialog")).toContainText(`Remove ${label}’s staff access?`);
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove access" }).click();
    await expect(page.getByTestId("staff-item").filter({ hasText: label })).toHaveCount(0);
  });

  test("integrations: five honest 'Local demo: simulated' cards, env var names, the state legend, and a reset button (not clicked)", async ({ page }) => {
    await open(page, "settings/integrations");
    for (const n of ["Clerk", "Supabase", "Resend", "Scheduled jobs", "Instant updates"]) await expect(page.getByRole("heading", { name: n, exact: true })).toBeVisible();
    await expect(page.getByText("Local demo: simulated")).toHaveCount(5);
    for (const v of ["CLERK_SECRET_KEY", "RESEND_API_KEY", "CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL"]) await expect(page.getByText(v, { exact: true }).first()).toBeVisible();
    for (const s of ["Connected", "Misconfigured", "Failing"]) await expect(page.getByText(s, { exact: true })).toBeVisible();
    await expect(page.getByTestId("reset-demo")).toBeEnabled(); // deliberately NOT clicked: it would reset every other spec's data
  });
});

test.describe("audit", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, "dev-admin"); }); // admin only (F-18)

  test("newest first, plain-language actions, and a result count", async ({ page }) => {
    await open(page, "audit");
    await expect(page.getByText(/^\d+ results?$/)).toBeVisible();
    const times = await page.locator("main ol time").evaluateAll((els) => els.map((e) => Date.parse(e.getAttribute("datetime") ?? "")));
    expect(times.length).toBeGreaterThan(5);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(await page.locator("main ol").innerText()).not.toMatch(/\b(event\.update|registration\.decide|membership\.approve)\b/);
  });

  test("action-group, actor and range filters narrow server-side and live in the URL", async ({ page }) => {
    await open(page, "audit");
    const results = page.getByText(/^\d+ results?$/);
    const all = await number(results);
    await page.getByRole("group", { name: "Action", exact: true }).getByRole("button", { name: "Members" }).click();
    await expect(page).toHaveURL(/group=members/);
    await expect.poll(() => number(results)).toBeLessThan(all);
    for (const g of await page.locator("main ol li button").evaluateAll((els) => els.map((e) => e.getAttribute("data-group")))) expect(g).toBe("members");
    const members = await number(results);
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).not.toHaveURL(/group=/);
    await expect.poll(() => number(results)).toBeGreaterThan(members); // other specs write to the shared audit log, so no exact total
    await page.getByRole("button", { name: /^Date range/ }).click();
    await page.getByRole("button", { name: "Last 30 days" }).click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=/);
    await expect.poll(() => number(results)).toBeLessThanOrEqual(all);
    await chooseOption(page, page.getByRole("combobox", { name: "Who did it" }), "Dev Admin");
    await expect(page).toHaveURL(/actor=/);
  });

  test("a filter with no matches shows the empty state; junk params and out-of-range pages are tolerated", async ({ page }) => {
    await open(page, "audit?actor=nobody-with-this-id");
    await expect(page.getByRole("heading", { name: "Nothing found" })).toBeVisible();
    await open(page, "audit?group=%3Cscript%3E&from=forever&page=-7");
    await expect(page.locator("main ol li button").first()).toBeVisible();
    await open(page, "audit?page=999");
    await expect(page.locator("main ol li button").first()).toBeVisible();
  });

  test("a row opens the diff as readable before → after pairs", async ({ page }) => {
    await open(page, "audit?q=edited"); // other specs add many newer rows, so look for the edits through the search
    await page.getByRole("button", { name: / edited / }).first().click();
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
      await open(page, "audit?q=edited");
      await page.getByRole("button", { name: / edited / }).first().click();
      await page.getByRole("dialog").waitFor();
      await scan("audit diff");
    });
  }
});

// ── polish pass: phone layouts, profile card, application cards, comms tiles, audit story, settings timeline ───────────────
async function firstFreeGuestHandle(page: Page): Promise<string> {
  await status(page).getByRole("button", { name: /^Guest \d+/ }).click();
  const rows = page.locator("tbody tr");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const h = (await rows.nth(i).locator("td").nth(1).innerText()).match(/@([\w-]+)/)?.[1] ?? "";
    if (h && !PERSONA_HANDLES.includes(h)) return h;
  }
  return "";
}

test.describe("phone polish", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("directory: chips fold behind Filters, the segment row scrolls with a cue, rows are cards", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members");
    const season = page.getByRole("group", { name: "Year", exact: true });
    await expect(season).toBeHidden();
    const filters = page.getByRole("button", { name: /^Filters/ });
    await expect(filters).toHaveAttribute("aria-expanded", "false");
    await filters.click();
    await expect(season).toBeVisible();
    await expect(page.getByRole("group", { name: "Team", exact: true })).toBeVisible();
    await season.getByRole("button", { name: /^2025/ }).click();
    await expect(page.getByRole("button", { name: /^Filters 1/ })).toBeVisible(); // the active count shows on the folded button
    // 360px-class phones clip the third tab: the SegmentedTabs row must scroll and carry the fade cue (a mask).
    await page.setViewportSize({ width: 360, height: 800 });
    const seg = page.getByRole("navigation", { name: "Members sections" });
    await expect.poll(() => seg.evaluate((el) => getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage)).not.toBe("none");
    // Phones show one card per person (avatar + name, then labelled Status / School), not a wide table.
    await expect(page.getByRole("table")).toHaveCSS("display", "block");
  });

  test("bulk bar stays in view at the bottom while scrolling a long list", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members");
    await page.locator("tbody tr").nth(2).getByRole("checkbox").check();
    const bar = page.getByRole("group", { name: "Actions for the selected people" });
    await expect(bar).toBeVisible();
    await page.mouse.wheel(0, 500);
    await expect.poll(async () => (await bar.boundingBox())?.y ?? 0).toBeGreaterThan(400);
    const box = await bar.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  });

  test("applications: full-width Approve (primary) and Reject, a labelled private-note disclosure", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members?tab=applications");
    test.skip((await page.getByRole("button", { name: "Approve", exact: true }).count()) === 0, "no pending applications left in the shared demo data");
    const approve = page.getByRole("button", { name: "Approve", exact: true }).first();
    const reject = page.getByRole("button", { name: "Reject", exact: true }).first();
    expect((await approve.boundingBox())!.width).toBeGreaterThan(280);
    expect((await reject.boundingBox())!.width).toBeGreaterThan(280);
    expect((await approve.boundingBox())!.y).toBeLessThan((await reject.boundingBox())!.y); // primary first on a phone
    await expect(page.getByText("Add a private note (only staff can see it)").first()).toBeVisible();
    await expect(page.locator("blockquote").first()).toBeVisible();
  });

  test("comms rows stay inside the screen: previews are icon buttons with names", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "comms");
    const preview = page.getByRole("button", { name: /^Preview:/ }).first();
    const box = await preview.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(40);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  });
});

test.describe("profile card", () => {
  test("the drawer is a profile card; Change status asks, names the person and the new status, and round-trips", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "members");
    const handle = await firstFreeGuestHandle(page);
    test.skip(handle === "", "no non-persona guest left in the shared demo data");
    await page.getByRole("searchbox", { name: "Search" }).fill(handle);
    await expect(page.getByText(/^\d+ results?$/)).toHaveText("1 result"); // the search is debounced
    await page.getByRole("button", { name: /Open .*’s profile/ }).first().click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText(`@${handle}`).first()).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Season history" })).toBeVisible();
    await drawer.getByRole("button", { name: "Change status" }).click();
    await expect(drawer.getByText("Choose the new status")).toBeVisible();
    await expect(drawer.getByRole("button", { name: "Guest", exact: true })).toHaveCount(0); // the current status is not offered
    await drawer.getByRole("button", { name: "Member", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toContainText(/Set .+ as “Member”\?/);
    await page.getByRole("alertdialog").getByRole("button", { name: "Promote to member" }).click();
    await expect(drawer.getByRole("status").filter({ hasText: /is now “Member”/ })).toBeVisible();
    // Put the shared data back.
    await drawer.getByRole("button", { name: "Change status" }).click();
    await drawer.getByRole("button", { name: "Guest", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Set guest" }).click();
    await expect(drawer.getByRole("status").filter({ hasText: /is now “Guest”/ })).toBeVisible();
  });
});

test.describe("look and feel", () => {
  test("comms: budget meter plus four tinted KPI tiles with 3D icons", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await open(page, "comms");
    await expect(page.getByRole("meter")).toBeVisible();
    for (const k of ["Sent", "Queued", "Failed", "Skipped"]) await expect(page.locator('section[aria-labelledby="comms-kpis"]').getByText(k, { exact: true })).toBeVisible();
    expect(await page.locator('section[aria-labelledby="comms-kpis"] img[src*="icons3d"]').count()).toBeGreaterThanOrEqual(5); // send + mail, clock, bell, shield
  });

  test("audit: rows are grouped by day under sticky headers, one human sentence per row, and the diff drawer opens", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "audit?group=staff"); // seeded grants from different months: several days even when today's rows fill page 1
    const headers = page.locator("main ol > li > h3");
    expect(await headers.count()).toBeGreaterThanOrEqual(2);
    expect(await headers.first().evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
    const first = page.locator("main ol li ul li button").first();
    await expect(first).toContainText(/^(Dev Admin|Dev Organizer|[\w -]+) (created|edited|published|approved|rejected|decided|changed|updated|applied|gave|merged|saved|emailed|re-queued)/);
    expect(await page.locator("main ol").innerText()).not.toMatch(/\b(event\.update|membership\.approve)\b/);
    await first.click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Changes" })).toBeVisible();
  });

  test("audit: the empty state offers a way out", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "audit?actor=nobody-with-this-id");
    await expect(page.getByRole("main").getByRole("button", { name: "Clear filters" }).first()).toBeVisible();
  });

  test("settings: seasons are a timeline with the current season highlighted; staff are cards with avatars and role pills", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "settings");
    const items = page.getByTestId("season-item");
    expect(await items.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('[data-testid="season-item"][data-current="true"]')).toHaveCount(1);
    await open(page, "settings/staff");
    const mine = page.getByTestId("staff-item").filter({ hasText: "Dev Admin" });
    await expect(mine.getByText("Admin", { exact: true })).toBeVisible();
    await expect(mine.getByText("DA", { exact: true })).toBeVisible(); // avatar initials
  });

  test("integrations: five 3D icons (passkey, lock, mail, clock, wifi) and a legend with all four states", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "settings/integrations");
    for (const n of ["passkey", "lock", "mail", "clock", "wifi"]) await expect(page.locator(`main li img[src*="${n}.png"], main li img[src*="${n}.png"]`).first()).toHaveCount(1);
    for (const s of ["Simulated", "Connected", "Misconfigured", "Failing"]) await expect(page.getByText(s, { exact: true })).toBeVisible();
  });

  test("merge: the empty list and the compare view each have one clear next action", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await open(page, "members?tab=merge");
    await expect(page.getByRole("button", { name: "Compare" }).first().or(page.getByRole("link", { name: "Pick two manually" }))).toBeVisible();
  });
});
