// Member app (/[lang]/me). The mock database is shared and mutable (other specs and agents write to it), so every
// flow here starts by putting its own persona into a known state (withdraw an old application, cancel an old RSVP)
// and tolerates data it did not create.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";
import { resetDemo } from "./helpers/reset";

const HOME = (l = "en") => `/${l}/me`;
const run = Date.now().toString(36);

/** Leaves any application to the event (withdraws it) so the form is shown. Safe to call when there is none. */
async function resetApplication(page: Page, slug = "devhack-2027", code = "") {
  await page.goto(`/en/me/events/${slug}/apply${code}`);
  const withdraw = page.getByRole("button", { name: "Withdraw application" });
  await Promise.race([withdraw.waitFor(), page.getByRole("button", { name: "Continue" }).waitFor()]).catch(() => undefined);
  if (await withdraw.isVisible()) {
    await withdraw.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Withdraw application" }).click();
    await expect(page.getByText("RSVP cancelled")).toBeVisible();
    await page.goto(`/en/me/events/${slug}/apply${code}`);
  }
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
}

const card = (page: Page, title: string) => page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });

test.describe("access", () => {
  test("signed-out visitors are sent to sign-in and come back to the page they asked for", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/me/events");
    await page.waitForURL(/\/en\/sign-in\?next=%2Fen%2Fme%2Fevents/);
  });

  test("onboarding next= only ever follows same-site paths", async ({ page }) => {
    await signInAs(page, "anuujin"); // already onboarded: the page just redirects to a safe `next`
    await page.goto("/en/me/onboarding?next=//evil.example/steal");
    await page.waitForURL((u) => u.pathname === "/en/me");
    expect(new URL(page.url()).host).toBe(new URL("http://localhost:3100").host);
  });

  test("someone who is not on a team gets the ordinary not-found page for it", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await page.goto("/en/me/teams/t_does_not_exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("an RSVP event has no application form", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/events/alumni-night/apply");
    await expect(page.getByRole("heading", { name: "This event doesn't need an application" })).toBeVisible();
  });
});

test.describe("onboarding", () => {
  test("a brand-new guest completes onboarding, then lands on Home (already-onboarded runs go straight to Home)", async ({ page, request }) => {
    await resetDemo(request); // new-guest is only "brand new" until someone finishes onboarding
    await signInAs(page, "new-guest");
    await page.goto(HOME());
    await expect(page.locator("main h1").first()).toBeVisible();
    if (page.url().includes("/me/onboarding")) {
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(page.getByText("Enter your name in Mongolian.")).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Mongolian" })).toBeFocused();
      await expect(page.getByText("Enter your school (up to 80 characters).")).toBeVisible();
      await page.getByRole("textbox", { name: "Mongolian" }).fill("Тест Шинэ");
      await page.getByRole("textbox", { name: "English" }).fill("Test New");
      await page.getByLabel("School").fill("NUM · SIT");
      await page.getByLabel("Graduation year").selectOption("2029");
      await page.getByRole("button", { name: "Continue" }).click();
      await page.waitForURL((u) => u.pathname === "/en/me");
    }
    await expect(page.getByRole("heading", { level: 1, name: /Hi/ })).toBeVisible();
    // Brand-new people get the welcome empty state, not a blank screen.
    await expect(page.getByRole("heading", { name: /What's next|Welcome!/ }).first()).toBeVisible();
  });
});

test.describe("events: RSVP and cancel", () => {
  test("round trip with a named confirmation", async ({ page }) => {
    await signInAs(page, "temuulen");
    // Start clean: if an earlier run left the RSVP in place, cancel it.
    await page.goto("/en/me/events?tab=going");
    const leftover = card(page, "Alumni Night");
    if (await leftover.count()) {
      await leftover.getByRole("button", { name: "Cancel RSVP" }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Cancel RSVP" }).click();
      await expect(page.getByText("RSVP cancelled")).toBeVisible();
    }

    await page.goto("/en/me/events?tab=upcoming");
    await card(page, "Alumni Night").getByRole("button", { name: "I'm going" }).click();
    await expect(page.getByRole("status").filter({ hasText: "You're going" })).toBeVisible();

    await page.goto("/en/me/events?tab=going");
    const mine = card(page, "Alumni Night");
    await expect(mine.getByText("Going", { exact: true })).toBeVisible();
    await mine.getByRole("button", { name: "Cancel RSVP" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Cancel your RSVP to “Alumni Night”?");
    await dialog.getByRole("button", { name: "Keep it" }).click(); // Escape/Cancel never confirm
    await expect(mine).toBeVisible();
    await mine.getByRole("button", { name: "Cancel RSVP" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Cancel RSVP" }).click();
    await expect(page.getByText("RSVP cancelled")).toBeVisible();
    await page.goto("/en/me/events?tab=upcoming");
    await expect(card(page, "Alumni Night").getByRole("button", { name: "I'm going" })).toBeVisible();
  });

  test("members-only events are greyed with the reason for a guest, and cannot be RSVPed", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/events?tab=upcoming");
    const git = card(page, "Online Workshop: Practical Git");
    await expect(git.getByText("Members only")).toBeVisible();
    await expect(git.getByRole("button", { name: "I'm going" })).toBeDisabled();
  });

  test("an empty tab says what it is and offers one action", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/events?tab=past");
    await expect(page.getByRole("heading", { name: "No past events yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "See upcoming events" })).toBeVisible();
  });

  test("changes made in another tab show up live, without a reload", async ({ page, context }) => {
    await signInAs(page, "dev-organizer");
    await page.goto("/en/me/events?tab=going");
    const count = async () => Number(((await page.getByRole("link", { name: /^Going/ }).innerText()).match(/\d+/) ?? ["0"])[0]);
    const before = await count();

    const other = await context.newPage();
    await other.goto("/en/me/events?tab=going");
    const leftover = card(other, "Alumni Night");
    let joined: boolean;
    if (await leftover.count()) {
      await leftover.getByRole("button", { name: "Cancel RSVP" }).click();
      await other.getByRole("alertdialog").getByRole("button", { name: "Cancel RSVP" }).click();
      joined = false;
    } else {
      await other.goto("/en/me/events?tab=upcoming");
      await card(other, "Alumni Night").getByRole("button", { name: "I'm going" }).click();
      joined = true;
    }
    await expect.poll(count, { timeout: 15_000 }).toBe(before + (joined ? 1 : -1));
    // put it back
    await other.goto("/en/me/events?tab=" + (joined ? "going" : "upcoming"));
    if (joined) {
      await card(other, "Alumni Night").getByRole("button", { name: "Cancel RSVP" }).click();
      await other.getByRole("alertdialog").getByRole("button", { name: "Cancel RSVP" }).click();
    } else {
      await card(other, "Alumni Night").getByRole("button", { name: "I'm going" }).click();
    }
    await expect.poll(count, { timeout: 15_000 }).toBe(before);
    await other.close();
  });
});

test.describe("hackathon application", () => {
  test.describe.configure({ mode: "serial" });
  const team = `E2E Crew ${run}`;
  let code = "";
  let teamUrl = "";

  test("validation errors map to the questions, then a team is created and the invite code is shown", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await resetApplication(page);

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Fix 2 fields" })).toBeVisible();
    await expect(page.getByText("“Your main skills” is required.")).toBeVisible();
    await expect(page.getByText("“Hackathon experience” is required.")).toBeVisible();
    await expect(page.getByLabel(/Your main skills/)).toBeFocused();

    await page.getByLabel(/Your main skills/).fill("Go, Postgres");
    await page.getByLabel(/GitHub or portfolio link/).fill("not a link");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/“Hackathon experience” is required\./)).toBeVisible();
    await expect(page.getByLabel(/Hackathon experience/)).toBeFocused();
    await page.getByLabel(/Hackathon experience/).selectOption({ label: "Intermediate" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/enter a link starting with http/)).toBeVisible();
    await expect(page.getByLabel(/GitHub or portfolio link/)).toBeFocused();
    await page.getByLabel(/GitHub or portfolio link/).fill("https://github.example.com/me");
    await page.getByRole("button", { name: "Continue" }).click();

    // team step
    await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
    await page.getByText("Create a team").click();
    await page.getByLabel(/Team name/).fill("x");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Team name must be 2–40 characters.")).toBeVisible();
    await expect(page.getByLabel(/Team name/)).toBeFocused();
    await page.getByLabel(/Team name/).fill(team);
    await page.getByRole("button", { name: "Continue" }).click();

    // review → submit
    await expect(page.getByText(`New team: ${team}`)).toBeVisible();
    await expect(page.getByText("Go, Postgres")).toBeVisible();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByRole("heading", { name: "Application sent!" })).toBeVisible();
    code = (await page.getByTestId("invite-code").innerText()).trim();
    expect(code).toMatch(/^HK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    await expect(page.getByText("You'll get the calendar invite if you're accepted.")).toBeVisible();
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();

    await page.getByRole("link", { name: "View your team" }).click();
    await expect(page.getByRole("heading", { level: 1, name: team })).toBeVisible();
    teamUrl = new URL(page.url()).pathname;
    await expect(page.getByTestId("team-code")).toHaveText(code);
    await expect(page.getByText("Captain")).toBeVisible();
    await expect(page.getByText("(you)")).toBeVisible();
  });

  test("a teammate joins with the invite link: the code is pre-filled and checked live; outsiders cannot see the team", async ({ page }) => {
    test.skip(!code, "needs the team from the previous test");
    await signInAs(page, "saraa");
    await resetApplication(page, "devhack-2027", `?code=${code}`);
    await page.getByLabel(/Your main skills/).fill("Design");
    await page.getByLabel(/Hackathon experience/).selectOption({ label: "Beginner" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel(/Invite code/)).toHaveValue(code);
    await expect(page.getByText(new RegExp(`Team found: ${team}`))).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page.getByRole("heading", { name: "Application sent!" })).toBeVisible();
    await page.getByRole("link", { name: "View your team" }).click();
    await expect(page.getByRole("heading", { level: 1, name: team })).toBeVisible();
    await expect(page.getByText("2 / 4 people")).toBeVisible();

    // someone outside the team: same page is indistinguishable from "does not exist"
    await signInAs(page, "dev-admin");
    await page.goto(teamUrl);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByText(team)).toHaveCount(0);
  });

  test("a wrong code is reported before submitting", async ({ page }) => {
    await signInAs(page, "saraa");
    await resetApplication(page, "devhack-2027", "?code=ZZ-0000");
    await page.getByLabel(/Your main skills/).fill("x");
    await page.getByLabel(/Hackathon experience/).selectOption({ label: "Beginner" });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("No team with this code for this event.")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel(/Invite code/)).toBeFocused();
  });

  test("cleanup: both applications are withdrawn and the team disappears", async ({ page }) => {
    for (const who of ["saraa", "dev-organizer"]) {
      await signInAs(page, who);
      await resetApplication(page);
    }
    await signInAs(page, "dev-organizer");
    await page.goto(teamUrl || "/en/me/teams/none");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

test.describe("app-like polish", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Home: the next event is a ticket with a countdown and quick actions (calendar, directions, cancel)", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto(HOME());
    const ticket = page.getByRole("article", { name: "Your next event" });
    test.skip((await ticket.count()) === 0, "needs an upcoming RSVP in the seed");
    await expect(ticket.getByRole("link", { name: "Calendar", exact: true })).toHaveAttribute("href", /\/api\/events\/[^/]+\/ics$/);
    await expect(ticket.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /google\.com\/maps\/search/);
    await expect(ticket.getByRole("button", { name: "Cancel RSVP" })).toBeVisible();
    await expect(ticket.getByText(/tomorrow|today|in \d+ (days?|hours?|minutes?)/)).toBeVisible();
    for (const control of [ticket.getByRole("link", { name: "Calendar", exact: true }), ticket.getByRole("link", { name: "Directions" }), ticket.getByRole("button", { name: "Cancel RSVP" })]) {
      expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const poster = await ticket.locator("img").first().boundingBox();
    expect(poster?.height ?? 0).toBeGreaterThan(200); // the poster is large, not a thumbnail
  });

  test("event cards keep one poster ratio on every tab (the whole poster is shown, never cropped)", async ({ page }) => {
    await signInAs(page, "temuulen");
    for (const tab of ["upcoming", "going"]) {
      await page.goto(`/en/me/events?tab=${tab}`);
      await page.locator("main h1").first().waitFor();
      // A stacked card (poster spans the card) has a fixed 5:4 slot; a wide card (poster beside the text) has a fixed width.
      const slots = await page.locator("article [data-poster]").evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        const a = el.closest("article")!.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), stacked: r.width >= a.width - 2 };
      }));
      for (const s of slots) {
        if (s.stacked) expect(Math.abs(s.h - s.w * 0.8), `${tab}: ${s.w}x${s.h}`).toBeLessThanOrEqual(2);
        else expect(s.w, `${tab}: ${s.w}x${s.h}`).toBe(224);
      }
    }
  });

  test("apply flow: step indicator, sticky Back/Next bar, tab bar steps aside, review summarises the answers", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await resetApplication(page);
    const tabs = page.locator('nav[aria-label="Main menu"]:visible');
    await expect(tabs).toHaveCount(0); // the flow owns the bottom of the screen
    await expect(page.getByRole("list", { name: "Application progress" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    const next = page.getByRole("button", { name: "Continue" });
    const box = await next.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(844 - 100); // pinned to the bottom edge
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(0);
    await expect(page.getByRole("button", { name: "Back" })).toHaveCount(0);

    await page.getByLabel(/Your main skills/).fill("Go, Postgres");
    await page.getByLabel(/Hackathon experience/).selectOption({ label: "Intermediate" });
    await next.click();
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
    // `force`: in `next dev` the round dev-tools badge sits over the bottom-left corner and would swallow the click (not present in production).
    await page.getByRole("button", { name: "Back" }).dispatchEvent("click");
    await expect(page.getByLabel(/Your main skills/)).toHaveValue("Go, Postgres"); // going back keeps the answers
    await next.click();
    await page.getByText("On my own").click();
    await next.click();
    await expect(page.getByRole("heading", { name: "Review and submit" })).toBeVisible();
    await expect(page.getByText("Go, Postgres")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit: Questions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit application" })).toBeVisible();
  });

  test("settings are grouped into icon cards with 44px switches", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/settings");
    for (const name of ["Notifications", "Language", "Privacy", "Calendar feed", "Theme", "Install the app"]) await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
    for (const sw of await page.getByRole("switch").all()) {
      const row = await sw.locator("xpath=ancestor::label").boundingBox();
      expect(row?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("empty and blocked states pair a sticker with one action", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/events?tab=past");
    const empty = page.locator("main img").last(); // the Manul
    await expect(empty).toBeVisible();
    await expect(page.getByRole("link", { name: "See upcoming events" })).toHaveCount(1);
    await page.goto("/en/me/events/alumni-night/apply");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Event page" })).toBeVisible();
  });
});

test.describe("sign-in picker", () => {
  test("reads as who you are signing in as: initials, role chip, what you can do, where you land", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/sign-in");
    await page.locator("details[data-demo-accounts] summary").click(); // demo accounts are collapsed by default
    const member = page.locator("li", { hasText: /Member \(Anuujin\)/ });
    await expect(member.getByText("Signing in as")).toBeVisible();
    await expect(member.getByText("Member", { exact: true })).toBeVisible();
    await expect(member.getByText("What you can do")).toBeVisible();
    await expect(member.getByText("Opens your member app")).toBeVisible();
    await expect(member.getByText("AB", { exact: true })).toBeVisible();
    await expect(page.locator("li", { hasText: /Dev admin/ }).getByText("Opens the backoffice")).toBeVisible();
    const ability = await member.locator("ul li").count();
    expect(ability).toBeGreaterThanOrEqual(3);
  });
});

test.describe("public RSVP panel", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("big glossy primary button, fact chips with icons, seats bar with count", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/events/alumni-night");
    await page.waitForLoadState("networkidle");
    const go = page.getByRole("button", { name: "I’m going" });
    await expect(go).toBeVisible();
    expect((await go.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(56);
    expect(await go.evaluate((el) => el.classList.contains("btn-primary"))).toBe(true);
    const facts = page.getByRole("region", { name: "Event details" });
    await expect(facts.locator("svg")).not.toHaveCount(0);
    await expect(facts.getByText("When")).toBeVisible();
    await signInAs(page, "anuujin");
    await page.goto("/en/events/knowledge-day-rag");
    await expect(page.getByRole("heading", { name: "Registration" })).toBeVisible();
    await expect(page.getByText(/\d+ of \d+ seats left/)).toBeVisible();
    await expect(page.locator("section", { hasText: "Registration" }).getByText(/^\d+\/\d+$/)).toBeVisible();
  });
});

test.describe("membership", () => {
  test("a guest from another school is told membership is for NUM students and gets no form", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/membership");
    await expect(page.getByRole("heading", { name: "Membership is for NUM students" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit application" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Update school and major" })).toHaveAttribute("href", "/en/me/profile#school");
    await expect(page.getByRole("link", { name: "Browse open events" })).toBeVisible();
  });

  test("a NUM guest applies (or sees the status of an application already in)", async ({ page }) => {
    await signInAs(page, "bayar");
    await page.goto("/en/me/membership");
    await expect(page.getByRole("heading", { level: 1, name: "Membership" })).toBeVisible();
    await expect(page.getByText(/applications are open until|applications open|Applications are closed/)).toBeVisible();
    const submit = page.getByRole("button", { name: "Submit application" });
    await page.waitForLoadState("networkidle");
    if (await submit.count()) {
      await page.getByLabel(/Why do you want to join/).fill("too short");
      await expect(page.getByText("9 / 1000")).toBeVisible();
      await submit.click();
      await expect(page.getByText("Write between 10 and 1000 characters.")).toBeVisible();
      await expect(page.getByLabel(/Why do you want to join/)).toBeFocused();
      await page.getByLabel(/Why do you want to join/).fill("I want to help run events and learn from older members.");
      await page.getByText("Dev", { exact: true }).click();
      await submit.click();
      await expect(page.getByRole("heading", { name: "Application status" })).toBeVisible();
    }
    // Whatever happened before, the person now sees a status, a membership history or the closed notice, never the staff note.
    await expect(page.getByText(/Under review|Approved|Not approved this time|You're a Hackum member|closed/).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/review_note|staff note/i);
  });

  test("a member sees their roster history by season", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/me/membership");
    await expect(page.getByRole("heading", { name: "You're a Hackum member" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Membership history" })).toBeVisible();
    await expect(page.getByText("Season 2026", { exact: true })).toBeVisible(); // the history row (the status card says "Member for Season 2026")
  });
});

test.describe("profile and settings", () => {
  test("badges: earned in colour, locked ones say how far away they are, coming-soon ones are labelled", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/me/profile");
    const two = page.locator('[data-badge="two-seasons"]');
    await expect(two).toHaveAttribute("data-earned", "true"); // anuujin has two seasons
    await expect(two).toContainText("Earned");
    await expect(page.locator('[data-badge="regular"]')).toHaveAttribute("data-earned", "true"); // she attended five autumn events
    await expect(page.locator('[data-badge="winner"]')).toContainText("Coming soon");
    // A guest who has attended nothing sees the same badge locked, with how far away it is.
    await signInAs(page, "temuulen");
    await page.goto("/en/me/profile");
    const regular = page.locator('[data-badge="regular"]');
    await expect(regular).toHaveAttribute("data-earned", "false");
    await expect(regular.getByText("5 to go", { exact: true })).toBeVisible();
    await expect(regular.locator(".sr-only")).toContainText("locked, 0 of 5, 5 to go");
  });

  test("notification toggles save optimistically and say Saved; the calendar feed is shown", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/settings");
    const reminders = page.getByRole("switch", { name: /Reminders/ });
    const was = await reminders.isChecked();
    const row = page.locator("label").filter({ hasText: "A reminder the day before" });
    await row.click();
    await expect(reminders).toBeChecked({ checked: !was }); // flips immediately
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("switch", { name: /Reminders/ })).toBeChecked({ checked: !was });
    await row.click(); // restore
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Add to calendar (webcal)" })).toHaveAttribute("href", /^webcal:\/\/localhost:3100\/api\/calendar\/[0-9a-f]+\.ics$/);
    await expect(page.getByTestId("calendar-https")).toContainText("/api/calendar/");
  });
});

for (const width of [360, 768, 1280]) {
  test.describe(`layout at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });
    const paths = ["/en/me", "/mn/me", "/en/me/events", "/en/me/events?tab=past", "/en/me/profile", "/en/me/settings", "/en/me/membership", "/en/me/events/devhack-2027/apply", "/en/sign-in", "/mn/sign-in", "/en/events/knowledge-day-rag"];

    test("no horizontal scroll on any screen", async ({ page }) => {
      await signInAs(page, "anuujin");
      for (const p of paths) {
        await page.goto(p);
        await page.locator("h1").first().waitFor();
        await page.waitForLoadState("networkidle");
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(sw, `${p} overflows at ${width}px`).toBeLessThanOrEqual(width);
      }
    });

    test(width < 768 ? "bottom tab bar: four tabs, 44px targets, current page marked" : "top tab row replaces the bottom bar", async ({ page }) => {
      await signInAs(page, "anuujin");
      await page.goto("/en/me/events");
      await page.locator("main h1").first().waitFor();
      const nav = page.locator('nav[aria-label="Main menu"]:visible');
      await expect(nav).toHaveCount(1);
      const links = nav.getByRole("link");
      await expect(links).toHaveCount(width >= 1024 ? 6 : 4); // the laptop rail adds Polls and Notifications
      await expect(nav.getByRole("link", { name: "Events" })).toHaveAttribute("aria-current", "page");
      for (const l of await links.all()) {
        const box = await l.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      const position = await nav.evaluate((el) => getComputedStyle(el).position);
      expect(position === "fixed").toBe(width < 768);
    });
  });
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe ${scheme}`, () => {
    const pages: [string, string][] = [
      ["anuujin", "/en/me"], ["temuulen", "/mn/me"], ["temuulen", "/en/me/events"], ["anuujin", "/en/me/events?tab=going"],
      ["anuujin", "/en/me/profile"], ["temuulen", "/en/me/settings"], ["temuulen", "/en/me/membership"], ["dev-organizer", "/en/me/events/devhack-2027/apply"],
      ["", "/en/sign-in"], ["temuulen", "/en/events/alumni-night"], ["anuujin", "/en/events/knowledge-day-rag"],
    ];
    for (const [who, path] of pages) {
      test(`no WCAG 2.2 A/AA violations on ${path} as ${who}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await signInAs(page, who);
        await page.goto(path);
        await page.locator("h1").first().waitFor();
        await page.waitForLoadState("networkidle");
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
      });
    }
  });
}
