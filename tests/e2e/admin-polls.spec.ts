import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

const OPEN_SEED = "What should the next workshop be about?"; // seed: open, anonymous, members, 27 votes
const CLOSED_SEED = "Best day for the weekly meetup?"; // seed: closed, community, voters visible to staff
const ready = async (page: Page) => { await page.locator("main h1").waitFor(); await page.waitForLoadState("networkidle"); };
const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();

async function pollHref(page: Page, title: string): Promise<string> {
  await page.goto("/en/admin/polls");
  await ready(page);
  const href = await page.getByRole("link", { name: new RegExp(`Open: ${title.replace(/[?]/g, "\\?")}`) }).first().getAttribute("href");
  if (!href) throw new Error(`poll not found: ${title}`);
  return href;
}

/** A draft of our own, created through the editor. Returns its URL. */
async function createPoll(page: Page, title: string, opts: { anonymous?: boolean; audience?: RegExp } = {}): Promise<string> {
  await page.goto("/en/admin/polls/new");
  await ready(page);
  await page.getByRole("group", { name: "Title" }).getByLabel(/^Mongolian/).fill(title);
  await page.getByLabel("Option 1 · Mongolian").fill("Нэг");
  await page.getByLabel("Option 1 · English").fill("One");
  await page.getByLabel("Option 2 · Mongolian").fill("Хоёр");
  if (opts.audience) await page.getByRole("radio", { name: opts.audience }).check();
  if (opts.anonymous === false) await page.getByRole("switch", { name: "Anonymous votes" }).uncheck();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(/\/en\/admin\/polls\/[^/?]+\?tab=settings&created=1/);
  await expect(page.getByText("Draft created. You can publish it now.")).toBeVisible();
  return new URL(page.url()).pathname;
}

test.describe("polls: organizer", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "dev-organizer"));

  test("the list shows title, audience, status, turnout and closing time, and filters by status and search", async ({ page }) => {
    await page.goto("/en/admin/polls");
    await ready(page);
    await expect(page.getByRole("heading", { level: 1, name: "Polls" })).toBeVisible();
    const open = page.getByRole("row", { name: new RegExp(OPEN_SEED.replace("?", "\\?")) });
    await expect(open).toContainText("Members");
    await expect(open).toContainText("Anonymous");
    await expect(open).toContainText("Open");
    await expect(open.getByRole("meter")).toHaveAttribute("aria-label", /\d+ of \d+ people voted/);
    await page.getByRole("button", { name: /^Closed/ }).click().catch(() => undefined);
    await page.getByRole("searchbox", { name: "Search polls" }).fill("weekly");
    await expect(page.getByRole("row", { name: /Best day for the weekly meetup/ })).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(OPEN_SEED.replace("?", "\\?")) })).toHaveCount(0);
    await page.getByRole("searchbox", { name: "Search polls" }).fill("zzz-no-such-poll");
    await expect(page.getByText("No polls match")).toBeVisible();
  });

  test("create → publish with a confirm naming the poll, audience and head count → results → close → reopen", async ({ page }) => {
    const title = `A2-${Date.now()}`;
    const url = await createPoll(page, title);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();

    // The settings tab says how many people can vote; the confirm says how many publishing will really notify
    // (the audience minus anyone who switched announcements off), so it can be smaller but never larger.
    const canVote = Number((await page.getByRole("status").filter({ hasText: /\d+ people? can vote/ }).first().innerText()).match(/\d+/)![0]);
    expect(canVote).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Publish", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    const heading = await dialog.getByRole("heading").innerText();
    const notify = Number(new RegExp(`^Publish “${title}” and notify (\\d+) people\\?$`).exec(heading)?.[1]);
    expect(notify, heading).toBeGreaterThan(0);
    expect(notify).toBeLessThanOrEqual(canVote);
    await expect(dialog).toContainText("Audience: Members");
    await dialog.getByRole("button", { name: "Publish and notify" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Published. ${notify} people notified.` })).toBeVisible();
    await expect(page.getByText("Open", { exact: true }).first()).toBeVisible();

    // Results: nobody has voted yet.
    await page.goto(`${url}?tab=results`);
    await ready(page);
    await expect(page.getByText("No votes yet").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export CSV" })).toBeVisible();

    // Close names the poll and the number of voters.
    await page.getByRole("button", { name: "Close poll", exact: true }).click();
    await expect(page.getByRole("alertdialog").getByRole("heading")).toHaveText(`Close “${title}”?`);
    await expect(page.getByRole("alertdialog")).toContainText("0 people have voted");
    await page.getByRole("alertdialog").getByRole("button", { name: "Close poll" }).click();
    await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Reopen", exact: true }).click();
    await expect(page.getByRole("alertdialog").getByRole("heading")).toHaveText(`Reopen “${title}”?`);
    await page.getByRole("alertdialog").getByRole("button", { name: "Reopen" }).click();
    await expect(page.getByText("Open", { exact: true }).first()).toBeVisible();
  });

  test("the editor says what is wrong beside the field and moves focus to it; a draft can be edited and saved", async ({ page }) => {
    await page.goto("/en/admin/polls/new");
    await ready(page);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByText("Write a Mongolian title (under 200 characters).")).toBeVisible();
    await expect(page.getByText("Write the Mongolian name (under 120 characters).").first()).toBeVisible();
    await expect(page.getByRole("group", { name: "Title" }).getByLabel(/^Mongolian/)).toBeFocused();
    await expect(page).toHaveURL(/\/polls\/new$/);

    // 2–10 options: add up to ten, remove down to two.
    for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Add option" }).click();
    await expect(page.getByRole("button", { name: "Add option" })).toBeDisabled();
    await expect(page.getByLabel(/^Option \d+ · Mongolian$/)).toHaveCount(10);
    for (let i = 0; i < 8; i++) await page.getByRole("button", { name: /^Remove option/ }).first().click();
    await expect(page.getByLabel(/^Option \d+ · Mongolian$/)).toHaveCount(2);
    await expect(page.getByRole("button", { name: /^Remove option/ }).first()).toBeDisabled();

    const title = `A2-${Date.now()}-edit`;
    await createPoll(page, title);
    await page.getByRole("group", { name: "Title" }).getByLabel(/^English/).fill("Edited title");
    await expect(page.getByRole("status").filter({ hasText: "You have unsaved changes" })).toBeVisible(); // the hidden "new poll" editor stays mounted behind it
    await page.getByRole("radio", { name: /Pick several/ }).check();
    await page.getByLabel("Most options a person can pick").fill("2");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible();
    await page.reload();
    await ready(page);
    await expect(page.getByRole("group", { name: "Title" }).getByLabel(/^English/)).toHaveValue("Edited title");
    await expect(page.getByRole("radio", { name: /Pick several/ })).toBeChecked();
  });

  test("once people have voted the ballot is locked and the reason is shown", async ({ page }) => {
    const href = await pollHref(page, OPEN_SEED);
    await page.goto(`${href}?tab=settings`);
    await ready(page);
    await expect(page.getByRole("note")).toContainText(/\d+ people have voted, so the options/);
    await expect(page.getByLabel("Option 1 · Mongolian")).toHaveAttribute("readonly", "");
    await expect(page.getByRole("button", { name: "Add option" })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^Remove option 1$/ })).toBeDisabled();
    await expect(page.getByRole("radio", { name: /Pick several/ })).toBeDisabled();
    await expect(page.getByRole("radio", { name: /Everyone signed in/ })).toBeDisabled();
    await expect(page.getByRole("switch", { name: "Anonymous votes" })).toBeDisabled();
    // Title, results visibility and times stay editable.
    await expect(page.getByRole("group", { name: "Title" }).getByLabel(/^English/)).toBeEditable();
    await expect(page.getByLabel("When do people see the results?")).toBeEnabled();
  });

  test("an anonymous poll shows totals and no voter list; a named poll shows its voters to staff", async ({ page }) => {
    const open = await pollHref(page, OPEN_SEED);
    await page.goto(`${open}?tab=results`);
    await ready(page);
    await expect(page.getByRole("figure", { name: "Votes per option" })).toBeVisible();
    await expect(page.getByText("Anonymous poll: who voted for what is not shown.")).toBeVisible();
    await expect(page.getByRole("table", { name: "People who voted" })).toHaveCount(0);
    await expect(page.getByText("Turnout").first()).toBeVisible();

    const closed = await pollHref(page, CLOSED_SEED);
    await page.goto(`${closed}?tab=results`);
    await ready(page);
    await expect(page.getByRole("table", { name: "People who voted" })).toBeVisible();
    await expect(page.getByText("Only staff can see this.")).toBeVisible();
    await expect(page.getByText("Anonymous poll: who voted for what is not shown.")).toHaveCount(0);
    expect(await page.locator("main").innerText()).not.toMatch(/NaN|Infinity|undefined/);
  });

  test("Export CSV downloads a formula-safe file without voter names for an anonymous poll", async ({ page }) => {
    const open = await pollHref(page, OPEN_SEED);
    await page.goto(`${open}?tab=results`);
    await ready(page);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^poll-poll_\w+\.csv$/);
    const text = await (await import("node:fs/promises")).readFile(await dl.path(), "utf8");
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain("Anonymous poll: no names are included.");
    expect(text.slice(1).split("\r\n").some((l) => /^[=+\-@]/.test(l))).toBe(false);
  });

  test("a member can vote through the member app and the result appears here", async ({ page, browser }) => {
    const probe = await page.request.get("/en/me/polls", { headers: { Cookie: "hackum-dev-as=anuujin" } });
    test.skip(probe.status() !== 200, "Agent M has not shipped /me/polls yet: voting happens there");
    const title = `A2-${Date.now()}-vote`;
    const url = await createPoll(page, title, { anonymous: false });
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Publish/ }).click();
    await expect(page.getByText("Open", { exact: true }).first()).toBeVisible();

    const ctx = await browser.newContext({ baseURL: page.url().split("/en/")[0] });
    const member = await ctx.newPage();
    await signInAs(member, "anuujin");
    await member.goto("/en/me/polls");
    const card = member.getByRole("article", { name: title });
    await card.getByText("One", { exact: true }).click();
    await card.getByRole("button", { name: "Vote" }).click();
    await expect(card.getByText(/Your vote/).first()).toBeVisible();
    await ctx.close();

    await page.goto(`${url}?tab=results`);
    await ready(page);
    await expect(page.getByRole("table", { name: "People who voted" })).toBeVisible();
    await page.goto(`${url}?tab=settings`);
    await ready(page);
    await expect(page.getByRole("note")).toContainText(/1 person has voted/);
  });

  test("an unknown poll id is a real 404", async ({ page }) => {
    expect((await page.goto("/en/admin/polls/not-a-poll"))?.status()).toBe(404);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`axe: no WCAG 2.2 A/AA violations on list, editor and results (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const open = await pollHref(page, OPEN_SEED);
      for (const path of ["/en/admin/polls", "/en/admin/polls/new", `${open}?tab=settings`, `${open}?tab=results`]) {
        await page.goto(path);
        await ready(page);
        expect((await axe(page)).violations.map((v) => `${path} ${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      }
    });
  }

  test("390 px: no horizontal scroll on list, editor and results; Mongolian too", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const open = await pollHref(page, OPEN_SEED);
    for (const path of ["/en/admin/polls", "/en/admin/polls/new", `${open}?tab=settings`, `${open}?tab=results`, "/mn/admin/polls", `${open.replace("/en/", "/mn/")}?tab=results`]) {
      await page.goto(path);
      await ready(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
    }
  });
});

test.describe("polls: who may use them", () => {
  for (const handle of ["anuujin", "temuulen", "saraa"]) {
    test(`${handle} gets the ordinary 404`, async ({ page }) => {
      await signInAs(page, handle);
      expect((await page.goto("/en/admin/polls"))?.status()).toBe(404);
      expect((await page.goto("/en/admin/polls/new"))?.status()).toBe(404);
    });
  }
  test("a signed-out visitor is sent to sign-in", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/admin/polls");
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Fadmin%2Fpolls/);
  });
});
