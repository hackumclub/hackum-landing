// Member side of feedback and polls. The mock database is shared and mutable, so: feedback is answered on the seeded
// "Pitch Night" (anuujin owes it; the spec works whether or not it is her first answer), and every poll the spec votes in is
// one it creates itself (title prefix "M-", published by an organizer and closed again afterwards). The seeded open poll is
// never voted in, so the persona keeps an unvoted poll for other specs. No absolute counts are asserted.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

const PITCH = "Pitch Night · Autumn";
const PITCH_SLUG = "pitch-night-autumn";
const SEED_POLL = "What should the next workshop be about?";
const run = Date.now().toString(36);
const MULTI = `M-multi-${run}`;
const MEMBERS = `M-members-${run}`;

const ready = async (page: Page) => { await page.locator("main h1").waitFor(); await page.waitForLoadState("networkidle"); };
const axe = (page: Page) => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
const noHScroll = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
/** The radios are visually hidden inside their labels: click the label, as a person does. */
const pick = (page: Page, name: string | RegExp) => page.locator("label").filter({ has: page.getByRole("radio", { name }) }).click();
const cardFor = (page: Page, title: string) => page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

async function createPoll(page: Page, title: string, opts: { multi?: boolean; audience: RegExp }) {
  await page.goto("/en/admin/polls/new");
  await ready(page);
  await page.locator('input[name="title.mn"]').fill(title);
  await page.getByLabel("Option 1 · Mongolian").fill("Нэг");
  await page.getByLabel("Option 1 · English").fill("One");
  await page.getByLabel("Option 2 · Mongolian").fill("Хоёр");
  await page.getByLabel("Option 2 · English").fill("Two");
  if (opts.multi) {
    await page.getByRole("button", { name: "Add option" }).click();
    await page.getByLabel("Option 3 · Mongolian").fill("Гурав");
    await page.getByLabel("Option 3 · English").fill("Three");
    await page.getByRole("radio", { name: "Pick several" }).check();
    await page.getByLabel("Most options a person can pick").fill("2");
  }
  await page.getByRole("radio", { name: opts.audience }).check();
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("Draft created. You can publish it now.")).toBeVisible();
  const url = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish and notify" }).click();
  await expect(page.getByText(/Published\. \d+ people? notified\./)).toBeVisible();
  return url;
}

async function closePoll(page: Page, url: string) {
  await page.goto(url);
  await ready(page);
  await page.getByRole("button", { name: "Close poll", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: /^Close/ }).last().click();
  await expect(page.getByText("Closed", { exact: true }).first()).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("feedback", () => {
  test.beforeEach(async ({ page }) => signInAs(page, "anuujin"));

  test("Home offers the survey, the form validates, submitting anonymously says thank you and the card moves to the Past tab as Edit", async ({ page }) => {
    await page.goto("/en/me");
    await ready(page);
    const homeLink = page.getByRole("link", { name: new RegExp(`${PITCH}: give feedback`) });
    const firstAnswer = (await homeLink.count()) > 0;
    if (firstAnswer) {
      await expect(page.getByRole("heading", { level: 2, name: "Give feedback" })).toBeVisible();
      const li = page.getByRole("listitem").filter({ has: homeLink });
      await expect(li).toContainText(/Closes (in|tomorrow)/);
      await homeLink.click();
    } else {
      await page.goto(`/en/me/events/${PITCH_SLUG}/feedback`);
    }
    await expect(page).toHaveURL(new RegExp(`/en/me/events/${PITCH_SLUG}/feedback`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(PITCH);
    await ready(page);
    const send = page.getByRole("button", { name: /^(Send|Update) feedback$/ });
    await expect(page.getByRole("switch", { name: "Send my answer without my name" })).toBeVisible();
    if (firstAnswer) {
      await send.click();
      await expect(page.getByText("Pick a star rating.")).toBeVisible();
      await expect(page.getByRole("radio", { name: /^1 of 5/ })).toBeFocused();
    }
    await pick(page, "4 of 5, Great");
    await expect(page.getByText("You chose 4 of 5: Great")).toBeVisible();
    if (firstAnswer) {
      await send.click();
      await expect(page.getByText("Choose a number from 0 to 10.")).toBeVisible();
    }
    await pick(page, "9 of 10");
    await page.getByLabel(/What went well/).fill(`M-${run} lovely pitches`);
    await page.getByLabel(/What should improve/).fill(`M-${run} more time for questions`);
    await expect(page.getByText(/\d+ \/ 1000/).first()).toBeVisible();
    const anon = page.getByRole("switch", { name: "Send my answer without my name" });
    if (firstAnswer) await expect(anon).toBeChecked(); // on by default
    else if (!(await anon.isChecked())) await page.getByText("Send my answer without my name").click(); // a re-run starts from the previous edit
    await expect(anon).toBeChecked();
    await expect(page.getByText("Organizers read your comments without your name.")).toBeVisible();
    await send.click();
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse events" })).toBeVisible();

    await page.goto("/en/me");
    await ready(page);
    await expect(page.getByRole("link", { name: new RegExp(`${PITCH}: give feedback`) })).toHaveCount(0);
    await page.goto("/en/me/events?tab=past");
    await ready(page);
    const card = page.locator("article").filter({ has: page.getByRole("heading", { name: PITCH }) });
    await expect(card.getByRole("link", { name: /edit feedback/i })).toBeVisible();
  });

  test("editing shows the saved answer, says it can be changed, and the update sticks (keyboard only)", async ({ page }) => {
    await page.goto(`/en/me/events/${PITCH_SLUG}/feedback`);
    await ready(page);
    await expect(page.getByText(/You already answered\. You can change it and update until/)).toBeVisible();
    await expect(page.getByRole("radio", { name: "4 of 5, Great" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "9 of 10" })).toBeChecked();
    await expect(page.getByLabel(/What went well/)).toHaveValue(`M-${run} lovely pitches`);

    // Keyboard only: arrows choose, Tab moves on, Space flips the switch, Enter submits.
    await page.getByRole("radio", { name: "4 of 5, Great" }).focus();
    await page.keyboard.press("ArrowRight"); // 5 of 5
    await expect(page.getByRole("radio", { name: "5 of 5, Excellent" })).toBeChecked();
    await page.keyboard.press("Tab"); // into the 0-10 group, on the checked 9
    await expect(page.getByRole("radio", { name: "9 of 10" })).toBeFocused();
    await page.keyboard.press("ArrowLeft"); // 8
    await expect(page.getByRole("radio", { name: "8 of 10" })).toBeChecked();
    await page.keyboard.press("Tab");
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(`M-${run} edited with the keyboard`);
    await page.keyboard.press("Tab"); // improve
    await page.keyboard.press("Tab"); // the switch
    await expect(page.getByRole("switch", { name: "Send my answer without my name" })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByText("Organizers see your name next to your comments.")).toBeVisible();
    await page.keyboard.press("Tab"); // Update feedback
    await expect(page.getByRole("button", { name: "Update feedback" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Thank you" })).toBeFocused();
    await expect(page.getByText("Your answer was updated.")).toBeVisible();

    await page.goto(`/en/me/events/${PITCH_SLUG}/feedback`);
    await ready(page);
    await expect(page.getByRole("radio", { name: "5 of 5, Excellent" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "8 of 10" })).toBeChecked();
    await expect(page.getByLabel(/What went well/)).toHaveValue(`M-${run} edited with the keyboard`);
    await expect(page.getByRole("switch", { name: "Send my answer without my name" })).not.toBeChecked();
  });

  test("a guest who did not come, and an unknown event, get the ordinary not-found page", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto(`/en/me/events/${PITCH_SLUG}/feedback`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await page.goto("/en/me/events/no-such-event/feedback");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("a closed survey (an event from long ago) is not offered: there is no 'Give feedback' on old Past cards for people who never answered", async ({ page }) => {
    await page.goto("/en/me/events?tab=past");
    await ready(page);
    const old = page.locator("article").filter({ has: page.getByRole("heading", { name: /CSS Battle/ }) });
    if (await old.count()) await expect(old.getByRole("link", { name: /give feedback/i })).toHaveCount(0);
  });
});

test.describe("polls", () => {
  let multiUrl = "";
  let membersUrl = "";

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await signInAs(page, "dev-organizer");
    multiUrl = await createPoll(page, MULTI, { multi: true, audience: /^Everyone/ });
    membersUrl = await createPoll(page, MEMBERS, { audience: /^Members Club/ });
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await signInAs(page, "dev-organizer");
    for (const url of [multiUrl, membersUrl]) if (url) await closePoll(page, url).catch(() => undefined);
    await page.close();
  });

  test("Home shows an Open poll card that leads to the polls page; the seeded poll is listed and left unvoted", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/me");
    await ready(page);
    await expect(page.getByRole("heading", { level: 2, name: "Open poll" })).toBeVisible();
    await page.getByRole("link", { name: /: vote$/ }).first().click();
    await expect(page).toHaveURL(/\/en\/me\/polls/);
    await expect(page.getByRole("heading", { level: 1, name: "Club polls" })).toBeVisible();
    const seeded = cardFor(page, SEED_POLL);
    await expect(seeded).toBeVisible();
    await expect(seeded.getByText("Results appear after you vote")).toBeVisible();
    await expect(seeded.getByText("Members", { exact: true })).toBeVisible();
    await expect(seeded.getByText(/Closes (in|tomorrow)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Closed" })).toBeVisible();
  });

  test("vote for two of three (the third box is disabled with the reason), see the bars, change the vote", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/me/polls");
    await ready(page);
    const card = cardFor(page, MULTI);
    await expect(card.getByText("Choose up to 2")).toBeVisible();
    const vote = card.getByRole("button", { name: "Vote", exact: true });
    await expect(vote).toBeDisabled();
    await card.locator("label").filter({ hasText: "One" }).click();
    await card.locator("label").filter({ hasText: "Two" }).click();
    await expect(card.getByRole("checkbox", { name: "Three" })).toBeDisabled();
    await expect(card.getByText("You chose 2. Untick one to pick another.")).toBeVisible();
    await vote.click();
    await expect(card.getByText("Your vote", { exact: true }).first()).toBeVisible();
    await expect(card.getByText(/\d+ votes? · \d+%/).first()).toBeVisible();
    await expect(card.getByText(/\d+ of \d+ voted/)).toBeVisible();
    await expect(card.getByText("Your vote is anonymous.")).toBeVisible();
    await expect(card.getByText("Your vote", { exact: true })).toHaveCount(2); // One and Two are tagged, Three is not

    await card.getByRole("button", { name: "Change my vote" }).click();
    await expect(card.getByRole("checkbox", { name: "One" })).toBeChecked();
    await card.locator("label").filter({ hasText: "One" }).click();
    await card.locator("label").filter({ hasText: "Three" }).click();
    await card.getByRole("button", { name: "Change my vote" }).first().click();
    await expect(card.getByText("Your vote", { exact: true })).toHaveCount(2);
    await page.reload();
    await ready(page);
    const again = cardFor(page, MULTI);
    await again.getByRole("button", { name: "Change my vote" }).click();
    await expect(again.getByRole("checkbox", { name: "Two" })).toBeChecked();
    await expect(again.getByRole("checkbox", { name: "Three" })).toBeChecked();
    await expect(again.getByRole("checkbox", { name: "One" })).not.toBeChecked();
  });

  test("guests do not see a members-only poll (but do see an everyone poll); members do", async ({ page }) => {
    // temuulen is a guest for good. bayar (NUM guest) is one too unless an earlier spec approved her membership in the shared db.
    const personas = ["temuulen", "bayar"];
    for (const who of personas) {
      await signInAs(page, who);
      await page.goto("/en/me/membership");
      await ready(page);
      const member = await page.getByText("You're a Hackum member").isVisible();
      await page.goto("/en/me/polls");
      await ready(page);
      await expect(cardFor(page, MULTI)).toBeVisible();
      if (member) continue;
      await expect(cardFor(page, MEMBERS)).toHaveCount(0);
      await expect(cardFor(page, SEED_POLL)).toHaveCount(0);
    }
    await signInAs(page, "anuujin");
    await page.goto("/en/me/polls");
    await ready(page);
    await expect(cardFor(page, MEMBERS)).toBeVisible();
  });

  test("the closed tab lists finished polls with their results and no voting controls", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/me/polls?tab=closed");
    await ready(page);
    const closed = cardFor(page, "Best day for the weekly meetup?");
    await expect(closed).toBeVisible();
    await expect(closed.getByText(/Closed [A-Z][a-z]{2} \d+/)).toBeVisible();
    await expect(closed.getByRole("button", { name: /vote/i })).toHaveCount(0);
    await expect(closed.getByText(/\d+ votes? · \d+%/).first()).toBeVisible();
  });

  test("the rail has Polls on laptops and the phone tab bar keeps four tabs", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en/me/polls");
    await ready(page);
    await expect(page.getByRole("link", { name: "Polls", exact: true })).toHaveAttribute("aria-current", "page");
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/en/me");
    await ready(page);
    await expect(page.locator('nav[aria-label="Main menu"]:visible a')).toHaveCount(4);
    await page.goto("/en/me/events");
    await expect(page.getByRole("link", { name: "Club polls" })).toBeVisible();
  });
});

test.describe("quality", () => {
  const PAGES = [`/en/me/events/${PITCH_SLUG}/feedback`, "/en/me/polls"];
  test.beforeEach(async ({ page }) => signInAs(page, "anuujin"));

  for (const scheme of ["light", "dark"] as const) {
    for (const path of PAGES) {
      test(`axe: no WCAG 2.2 A/AA violations on ${path} (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(path);
        await ready(page);
        expect((await axe(page)).violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      });
    }
  }

  for (const [lang, path] of [["en", PAGES[0]], ["en", PAGES[1]], ["mn", PAGES[0].replace("/en/", "/mn/")], ["mn", "/mn/me/polls"]] as const) {
    test(`390 px: no horizontal scroll and 44 px targets on ${path}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      await ready(page);
      await noHScroll(page);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("main label, main button, main a, main [role=tab]")) {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (r.width === 0 || r.height === 0 || style.visibility === "hidden") continue;
          if (el instanceof HTMLLabelElement && el.control instanceof HTMLTextAreaElement) continue; // a caption: the text box it names is the target
          if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return out;
      });
      expect(small, `${lang} small targets`).toEqual([]);
    });
  }
});
