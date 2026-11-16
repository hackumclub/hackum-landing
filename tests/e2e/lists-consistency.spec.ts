// Every admin list behaves the same way (plan Task 12 + 19): one FilterBar, filters in the URL, rows that lead somewhere,
// the same drawer, the same selection bar. The mock database is shared and mutable, so nothing here asserts an absolute
// count: only relations (a filter narrows the list, a reload keeps it, a preset is honoured).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

test.setTimeout(120_000);

type ListCase = {
  name: string;
  /** Path, without the language prefix. */
  path: (ids: Ids) => string;
  /** Aria label of the first chip group (the filter we click). */
  group: string;
  search: string;
  /** What a click on a row does. */
  row: "drawer" | "drawer-buttons" | "navigates";
  selectable?: boolean;
};
type Ids = { devhack: string };

const LISTS: ListCase[] = [
  { name: "members", path: () => "/admin/members", group: "Status", search: "anuujin", row: "drawer", selectable: true },
  { name: "registrations", path: (i) => `/admin/events/${i.devhack}/registrations`, group: "Status", search: "a", row: "drawer", selectable: true },
  { name: "comms", path: () => "/admin/comms", group: "Status", search: "a", row: "drawer" },
  { name: "audit", path: () => "/admin/audit", group: "Action", search: "event", row: "drawer-buttons" },
  { name: "events", path: () => "/admin/events", group: "Status", search: "dev", row: "navigates" },
];

let ids: Ids;
test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signInAs(page, "dev-admin");
  await page.goto("/en/admin/events?q=devhack");
  const link = page.getByRole("link", { name: /^Open: .*DevHack/i }).first();
  await link.waitFor();
  const href = (await link.getAttribute("href")) ?? "";
  ids = { devhack: /\/admin\/events\/([^/?]+)/.exec(href)?.[1] ?? "" };
  await ctx.close();
});

test.beforeEach(async ({ page }) => { await signInAs(page, "dev-admin"); });

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const results = async (page: Page) => Number((await page.locator("[aria-live=polite], [role=status]").filter({ hasText: /\d+\s+(result|results|email|emails|үр дүн)/i }).first().innerText()).match(/\d+/)![0]);
const radius = (page: Page) => page.getByRole("dialog").evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
async function open(page: Page, l: ListCase, qs = "") {
  await page.goto(`/en${l.path(ids)}${qs}`);
  await page.locator("main h1").waitFor();
  await page.getByRole("searchbox").first().waitFor();
}

test.describe("one filter model", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const l of LISTS) {
    test(`${l.name}: FilterBar present, search and chips live in the URL and survive a reload`, async ({ page }) => {
      await open(page, l);
      const search = page.getByRole("searchbox").first();
      await expect(search).toBeVisible();

      await search.fill(l.search);
      await expect(page).toHaveURL(/[?&]q=/);
      await page.reload();
      await expect(page.getByRole("searchbox").first()).toHaveValue(l.search);
      expect(page.url()).toContain("q=");

      // "Clear filters" appears with only a chip set (and the search cleared first).
      await page.getByRole("button", { name: "Clear filters" }).click();
      await expect(page).not.toHaveURL(/[?&]q=/);
      await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
      const chip = page.getByRole("group", { name: l.group, exact: true }).getByRole("button").first();
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(page).toHaveURL(new RegExp(`[?&](${l.group === "Action" ? "group" : "status"})=`));
      await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("group", { name: l.group, exact: true }).getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "Clear filters" }).click();
      await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
    });

    test(`${l.name}: a filter with no match says what filtered it and offers Clear filters`, async ({ page }) => {
      await open(page, l);
      await page.getByRole("searchbox").first().fill("zzzz-no-such-thing-zzzz");
      const empty = page.getByRole("heading", { level: 3 }).first();
      await expect(empty).toBeVisible();
      await expect(page.getByText("zzzz-no-such-thing-zzzz").first()).toBeVisible(); // the summary names the search
      await page.getByRole("main").getByRole("button", { name: "Clear filters" }).first().click();
      await expect(page).not.toHaveURL(/[?&]q=/);
    });

    test(`${l.name}: a row leads somewhere (${l.row}); Esc closes a drawer and returns focus`, async ({ page }) => {
      await open(page, l);
      if (l.name === "comms" && (await page.locator("tbody tr").count()) === 0) test.skip(true, "the outbox is empty");
      if (l.row === "navigates") {
        await page.locator("tbody tr").first().locator("td").nth(2).click();
        await expect(page).toHaveURL(/\/en\/admin\/events\/[^/?]+$/);
        return;
      }
      if (l.row === "drawer-buttons") {
        const first = page.locator("ol li ul li button").first();
        await first.click();
      } else {
        await page.locator("tbody tr").first().locator("td").nth(l.selectable ? 2 : 1).click(); // a plain cell, not the name button
      }
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(await radius(page)).toBeGreaterThanOrEqual(24);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      if (l.row === "drawer-buttons") await expect(page.locator("ol li ul li button").first()).toBeFocused();
      else expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-open"))).toBe(true);
    });
  }

  test("members: school and track columns, and the NUM filter narrows the rows", async ({ page }) => {
    await open(page, LISTS[0]!);
    await expect(page.getByRole("columnheader", { name: "School" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Track" })).toBeVisible();
    const before = await results(page);
    await page.getByRole("group", { name: "School", exact: true }).getByRole("button", { name: /^NUM/ }).click();
    await expect(page).toHaveURL(/school=num/);
    await expect.poll(() => results(page)).toBeLessThan(before);
    expect(await results(page)).toBeGreaterThan(0);
    const rows = page.locator("tbody tr");
    const n = await rows.count();
    for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText("NUM");
    // a track chip narrows further and the URL carries both
    await page.getByRole("group", { name: "Track", exact: true }).getByRole("button", { name: /^Software/ }).click();
    await expect(page).toHaveURL(/school=num/);
    await expect(page).toHaveURL(/track=software/);
  });

  test("members: filters read the same in Mongolian (the URL holds codes, not labels)", async ({ page }) => {
    await page.goto("/en/admin/members?status=member&school=num");
    await page.locator("main h1").waitFor();
    const en = await results(page);
    await page.goto("/mn/admin/members?status=member&school=num");
    await page.locator("main h1").waitFor();
    expect(await results(page)).toBe(en);
  });
});

test.describe("tabs", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("members tabs are SegmentedTabs with counts and arrow keys; the tab is in the URL", async ({ page }) => {
    await page.goto("/en/admin/members");
    const directory = page.getByRole("link", { name: /^Directory/ });
    await expect(directory).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /^Applications/ })).toHaveAttribute("tabindex", "-1"); // roving tabindex
    await directory.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("link", { name: /^Applications/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/tab=applications/);
    await expect(page.getByRole("link", { name: /^Applications/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: /^Directory/ }).locator('[role="img"]')).toBeVisible(); // CountBadge
  });

  test("the old /applications and /merge URLs land on the matching tab", async ({ page }) => {
    await page.goto("/en/admin/members/applications");
    await expect(page).toHaveURL(/\/en\/admin\/members\?tab=applications/);
    await page.goto("/en/admin/members/merge");
    await expect(page).toHaveURL(/tab=merge/);
  });

  test("application status tabs are in-page SegmentedTabs: arrow keys select, and the choice is in the URL", async ({ page }) => {
    await page.goto("/en/admin/members?tab=applications");
    const pending = page.getByRole("tab", { name: /^Pending/ });
    await expect(pending).toHaveAttribute("aria-selected", "true");
    await pending.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /^Approved/ })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(/status=approved/);
    await page.reload();
    await expect(page.getByRole("tab", { name: /^Approved/ })).toHaveAttribute("aria-selected", "true");
  });

  test("applications show school and major, and explain (and block) anyone who is not NUM-eligible", async ({ page }) => {
    await page.goto("/en/admin/members?tab=applications");
    await page.getByRole("tab", { name: /^Pending/ }).waitFor();
    const cards = page.locator("main ul > li").filter({ has: page.getByRole("button", { name: "Approve" }) });
    const n = await cards.count();
    test.skip(n === 0, "no pending applications in this database");
    for (let i = 0; i < n; i++) {
      const card = cards.nth(i);
      await expect(card).toContainText(/Track|No track chosen|Software|Computer|Information|Other/); // school Tag and major track
      const note = card.getByRole("note");
      if (await note.count()) {
        await expect(note).toContainText("Not eligible for membership");
        await expect(card.getByRole("button", { name: "Approve" })).toBeDisabled();
        await expect(card.getByRole("button", { name: "Reject" })).toBeEnabled();
      } else {
        await expect(card.getByRole("button", { name: "Approve" })).toBeEnabled();
      }
    }
  });

  test("settings tabs are routed SegmentedTabs", async ({ page }) => {
    await page.goto("/en/admin/settings");
    const seasons = page.getByRole("link", { name: /^Seasons/ });
    await expect(seasons).toHaveAttribute("aria-current", "page");
    await seasons.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("link", { name: /^Staff/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/admin\/settings\/staff$/);
    await expect(page.getByRole("link", { name: /^Staff/ })).toHaveAttribute("aria-current", "page");
  });
});

test.describe("presets from the dashboard are honoured and removable", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("registrations ?status=applied", async ({ page }) => {
    await page.goto(`/en/admin/events/${ids.devhack}/registrations?status=applied`);
    const chip = page.getByRole("group", { name: "Status", exact: true }).getByRole("button", { name: /^Applied/ });
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
    await chip.click();
    await expect(page).not.toHaveURL(/status=applied/);
  });

  test("members ?tab=applications", async ({ page }) => {
    await page.goto("/en/admin/members?tab=applications");
    await expect(page.getByRole("link", { name: /^Applications/ })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("tab", { name: /^Pending/ })).toHaveAttribute("aria-selected", "true");
  });

  test("comms ?status=failed", async ({ page }) => {
    await page.goto("/en/admin/comms?status=failed");
    await expect(page.getByRole("group", { name: "Status", exact: true }).getByRole("button", { name: /^Failed/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
  });

  for (const filter of ["applications", "missing_cover", "needs_en"]) {
    test(`events ?filter=${filter} shows a removable chip`, async ({ page }) => {
      await page.goto(`/en/admin/events?filter=${filter}`);
      const remove = page.getByRole("button", { name: /^Remove filter:/ });
      await expect(remove).toBeVisible();
      await expect(page.getByRole("button", { name: "Clear filters" })).toBeVisible();
      await remove.click();
      await expect(page).not.toHaveURL(/filter=/);
      await expect(remove).toHaveCount(0);
    });
  }

  test("audit: the change is in the line, filters by object and date range, rows link to the object", async ({ page }) => {
    await page.goto("/en/admin/audit");
    await page.locator("main h1").waitFor();
    await page.getByRole("searchbox").first().fill("Draft → Published"); // the change line is part of what the search reads
    await expect(page.getByText("Draft → Published").first()).toBeVisible();
    await page.getByRole("group", { name: "Object", exact: true }).getByRole("button", { name: "Event" }).click();
    await expect(page).toHaveURL(/entity=event/);
    await page.getByText("Draft → Published").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("link", { name: "Open event" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Date range/ }).click();
    await page.getByRole("button", { name: "This year" }).click();
    await expect(page).toHaveURL(/from=\d{4}-01-01&to=\d{4}-12-31/);
    await page.reload();
    await expect(page.getByRole("button", { name: /Date range: .*–/ })).toBeVisible();
  });

  test("registration drawer links to the member and shows other registrations", async ({ page }) => {
    await page.goto(`/en/admin/events/${ids.devhack}/registrations`);
    await page.locator("tbody tr").first().locator("td").nth(2).click();
    const dialog = page.getByRole("dialog");
    const link = dialog.getByRole("link", { name: "Open member profile" });
    await expect(link).toHaveAttribute("href", /^\/en\/admin\/members\?q=.+/);
    await expect(dialog.getByText(/Other registrations/)).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/en\/admin\/members\?q=/);
    await expect(page.getByRole("searchbox").first()).not.toHaveValue("");
  });

  test("members drawer shows school, track, badges and links to the person's registrations", async ({ page }) => {
    await page.goto("/en/admin/members?q=anuujin");
    await page.locator("tbody tr").first().locator("td").nth(2).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Badges")).toBeVisible();
    await expect(dialog.getByText("NUM").first()).toBeVisible();
    await expect(dialog.getByText("Track").first()).toBeVisible();
  });
});

test.describe("phones (390 px)", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  for (const l of LISTS) {
    test(`${l.name}: no horizontal scroll`, async ({ page }) => {
      await page.goto(`/en${l.path(ids)}`);
      await page.locator("main h1").waitFor();
      await page.waitForLoadState("networkidle");
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }

  for (const l of LISTS.filter((x) => x.selectable)) {
    test(`${l.name}: the selection bar is sticky and stays in view`, async ({ page }) => {
      await page.goto(`/en${l.path(ids)}`);
      await page.locator("tbody tr").first().waitFor();
      await page.locator("tbody input[type=checkbox]").first().check();
      const bar = page.locator("div[class*='sticky'][class*='bottom-']").last();
      await expect(bar).toBeVisible();
      expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");
      // pinned to the bottom of the viewport while the table scrolls under it (admin has no bottom tab bar to sit above)
      for (const dy of [0, 400, 400]) {
        await page.mouse.wheel(0, dy);
        await expect.poll(async () => { const b = await bar.boundingBox(); return b ? b.y + b.height : Infinity; }).toBeLessThanOrEqual(800);
        expect((await bar.boundingBox())!.y).toBeGreaterThanOrEqual(0);
      }
      expect((await bar.boundingBox())!.height).toBeGreaterThan(0);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("console hygiene", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const path of ["/mn/admin/members", "/mn/admin/members?tab=applications", "/mn/admin/comms", "/mn/admin/audit", "/mn/admin/events"]) {
    test(`no hydration mismatch on ${path}`, async ({ page }) => {
      const bad: string[] = [];
      page.on("console", (m) => { if (m.type() === "error" && /hydrat|didn't match|did not match/i.test(m.text())) bad.push(m.text().slice(0, 200)); });
      page.on("pageerror", (e) => { if (/hydrat/i.test(e.message)) bad.push(e.message.slice(0, 200)); });
      await page.goto(path);
      await page.locator("main h1").waitFor();
      await page.waitForLoadState("networkidle");
      expect(bad).toEqual([]);
    });
  }
});

test.describe("accessibility", () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  for (const scheme of ["light", "dark"] as const) {
    for (const l of LISTS) {
      test(`axe: ${l.name} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, l);
        await page.waitForLoadState("networkidle");
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      });
    }
    test(`axe: members applications tab and an open member drawer (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/en/admin/members?tab=applications");
      await page.locator("main h1").waitFor();
      await page.waitForLoadState("networkidle");
      let { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      await page.goto("/en/admin/members?q=anuujin");
      await page.locator("tbody tr").first().locator("td").nth(2).click();
      await page.getByRole("dialog").waitFor();
      ({ violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze());
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
});
