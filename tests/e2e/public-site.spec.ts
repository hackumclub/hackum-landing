import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";
import { resetDemo } from "./helpers/reset";

// Reduced motion also turns off the site's smooth scrolling, which otherwise moves buttons while Playwright is clicking them.
test.use({ reducedMotion: "reduce" });

// The public site reads the shared, mutable mock database: assertions are relative or use data that no other area edits.
const ORIGIN = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
const KD = "knowledge-day-rag";
// Server-rendered buttons are visible before React hydrates; clicking earlier does nothing, so wait for the page to settle.
const settle = (page: Page) => page.waitForLoadState("networkidle");
const seatsLeft = async (page: Page) => Number(/(\d+) of \d+ seats left/.exec(await page.getByText(/\d+ of \d+ seats left/).innerText())?.[1]);

test.describe("events list", () => {
  test("renders a card per published/archived event, never drafts", async ({ page }) => {
    await page.goto("/en/events");
    const cards = page.locator("[data-ticket]:not([hidden])");
    await expect(cards.first()).toBeVisible();
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(6);
    await expect(page.locator("#event-count")).toHaveText(`${n} events`);
    await expect(page.locator(`a[href="/en/events/${KD}"]`)).toBeVisible();
    await expect(page.locator('a[href="/en/events/c-battle-winter"]')).toHaveCount(0);
  });

  test("search still filters the database-backed list", async ({ page }) => {
    await page.goto("/en/events");
    const total = await page.locator("[data-ticket]:not([hidden])").count();
    await page.getByRole("searchbox").fill("Knowledge");
    await expect(page.locator("[data-ticket]:not([hidden])")).not.toHaveCount(total);
    await expect(page.locator(`[data-ticket]:not([hidden]) a[href="/en/events/${KD}"]`)).toBeVisible();
  });

  test("shows the live pill", async ({ page }) => {
    await page.goto("/en/events");
    await expect(page.getByRole("status").filter({ hasText: /Live|Reconnecting/ })).toBeVisible();
  });
});

test.describe("event page status codes", () => {
  test("real slug 200, unknown slug 404, draft 404, in both languages", async ({ request }) => {
    expect((await request.get(`/mn/events/${KD}`)).status()).toBe(200);
    expect((await request.get(`/en/events/${KD}`)).status()).toBe(200);
    expect((await request.get("/mn/events/does-not-exist")).status()).toBe(404);
    expect((await request.get("/en/events/c-battle-winter")).status()).toBe(404);
  });

  test("malformed encodings still redirect to the clean 404 page", async ({ request }) => {
    const res = await request.get("/mn/events/%E0%A4%A", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain("/mn/page-not-found");
  });

  test("sitemap lists real event slugs and no drafts", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`/en/events/${KD}`);
    expect(xml).not.toContain("c-battle-winter");
  });
});

test.describe("registration panel", () => {
  // These tests share personas (and the one seat they change), so they run one after another.
  test.describe.configure({ mode: "serial" });
  test("signed out: sign-in call to action that returns to the event", async ({ page }) => {
    await signInAs(page, null);
    await page.goto(`/en/events/${KD}`);
    const cta = page.getByRole("link", { name: "Sign in to say you’re going" });
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute("href")).toBe(`/en/sign-in?next=${encodeURIComponent(`/en/events/${KD}`)}`);
    await expect(page.getByRole("button", { name: /I’m going/ })).toHaveCount(0);
  });

  test("not onboarded: finish the profile first", async ({ page, request }) => {
    await resetDemo(request); // an earlier spec may have finished new-guest's onboarding
    await signInAs(page, "new-guest");
    await page.goto(`/en/events/${KD}`);
    const cta = page.getByRole("link", { name: "Finish profile" });
    await expect(cta).toBeVisible();
    expect(await cta.getAttribute("href")).toContain("/en/me/onboarding?next=");
  });

  test("anuujin: RSVP → going → cancel round trip, seats move, and the original state is restored", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto(`/en/events/${KD}`);
    await settle(page);
    const going = page.getByText("You’re going", { exact: true });
    const rsvp = page.getByRole("button", { name: "I’m going" });
    const cancel = async () => {
      await page.getByRole("button", { name: "Cancel RSVP" }).click();
      await expect(page.getByText("Cancel your RSVP for “Knowledge Day: Building RAG Systems”?")).toBeVisible();
      await page.getByRole("button", { name: "Yes, cancel RSVP" }).click();
      await expect(rsvp).toBeVisible();
    };
    await expect(going.or(rsvp)).toBeVisible();
    const wasGoing = await going.isVisible();
    if (wasGoing) await cancel();

    const before = await seatsLeft(page);
    await rsvp.click();
    await expect(going).toBeVisible();
    await expect(page.getByRole("link", { name: "Download .ics" })).toHaveAttribute("href", /\/api\/events\/knowledge-day-rag\/ics/);
    await expect(page.getByRole("link", { name: "Google Calendar" })).toHaveAttribute("href", /calendar\.google\.com/);
    await expect.poll(() => seatsLeft(page)).toBeLessThan(before);

    await page.reload();
    await settle(page);
    await expect(going).toBeVisible(); // persisted, not just optimistic
    await cancel();
    await expect.poll(() => seatsLeft(page)).toBe(before);

    if (wasGoing) { await rsvp.click(); await expect(going).toBeVisible(); }
  });

  test("keeping the seat in the cancel confirm changes nothing", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto(`/en/events/${KD}`);
    await settle(page);
    const going = page.getByText("You’re going", { exact: true });
    const rsvp = page.getByRole("button", { name: "I’m going" });
    await expect(going.or(rsvp)).toBeVisible();
    if (await rsvp.isVisible()) { await rsvp.click(); await expect(going).toBeVisible(); }
    await page.getByRole("button", { name: "Cancel RSVP" }).click();
    await page.getByRole("button", { name: "Keep my seat" }).click();
    await expect(going).toBeVisible();
    await expect(page.getByRole("button", { name: "Yes, cancel RSVP" })).toHaveCount(0);
  });

  test("application event offers Apply (or shows the decision state) and never an RSVP button", async ({ page }) => {
    await signInAs(page, "saraa");
    await page.goto("/en/events/devhack-2027");
    await expect(page.getByRole("link", { name: "Apply", exact: true }).or(page.getByText(/Application received|Not selected this time/))).toBeVisible();
    await expect(page.getByRole("button", { name: /I’m going|waitlist/i })).toHaveCount(0);
    const apply = page.getByRole("link", { name: "Apply", exact: true });
    if (await apply.count()) expect(await apply.getAttribute("href")).toBe("/en/me/events/devhack-2027/apply");
  });

  test("members-only event gives a specific reason to a guest and no dead RSVP button", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/events/members-meetup-live");
    await expect(page.getByText("This event is for Hackum members only.")).toBeVisible();
    await expect(page.getByRole("button", { name: /I’m going/ })).toHaveCount(0);
  });

  test("the online link is not in the page for someone without a seat", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/events/online-workshop-git");
    expect(await page.content()).not.toContain("meet.example.com");
  });

  test("keyboard focus is visible on the RSVP button", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/events/alumni-night");
    await settle(page);
    const button = page.getByRole("button", { name: "I’m going" });
    await expect(button).toBeVisible();
    for (let i = 0; i < 80 && !(await button.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    const outline = await button.evaluate((el) => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});

test.describe("calendar routes", () => {
  test("single event .ics: PUBLISH, calendar content type, private cache, UTC instants", async ({ request }) => {
    const res = await request.get(`/api/events/${KD}/ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(res.headers()["cache-control"]).toBe("private, max-age=900");
    const body = await res.text();
    expect(body).toContain("METHOD:PUBLISH");
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(body).toContain("ORGANIZER:mailto:");
    expect(body).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  test("drafts and unknown events have no .ics", async ({ request }) => {
    expect((await request.get("/api/events/c-battle-winter/ics")).status()).toBe(404);
    expect((await request.get("/api/events/nope/ics")).status()).toBe(404);
  });

  test("club feed lists upcoming published events and no drafts", async ({ request }) => {
    const res = await request.get("/api/calendar/club.ics");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(res.headers()["cache-control"]).toBe("private, max-age=900");
    const body = await res.text();
    expect(body.match(/BEGIN:VEVENT/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(body).not.toContain("Өвлийн дугуй");
  });

  test("an unknown token gets the same 404 whatever is wrong with it (no existence leak)", async ({ request }) => {
    const a = await request.get("/api/calendar/not-a-real-token.ics");
    const b = await request.get("/api/calendar/not-a-real-token");
    const c = await request.get("/api/calendar/x.ics");
    expect([a.status(), b.status(), c.status()]).toEqual([404, 404, 404]);
    const bodies = await Promise.all([a.text(), b.text(), c.text()]);
    expect(new Set(bodies).size).toBe(1);
  });
});

test.describe("subscribe", () => {
  // Sign-ups are rate limited per client address; give every run its own so repeated runs do not trip the limit.
  const client = () => ({ "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` });
  const unique = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;

  test("happy path, then the same address again looks identical (no probing)", async ({ page }) => {
    const email = unique();
    await page.setExtraHTTPHeaders(client());
    await page.goto("/en/join");
    for (let round = 0; round < 2; round++) {
      await page.getByPlaceholder("Your name").fill("E2E Visitor");
      await page.getByPlaceholder("name@example.com").fill(round ? email.toUpperCase() : email);
      await page.getByRole("button", { name: "Notify me" }).click();
      await expect(page.getByText("You’re on the list!")).toBeVisible();
      if (!round) await page.getByRole("button", { name: "Add another email" }).click();
    }
  });

  test("honeypot, wrong origin and bad input", async ({ request }) => {
    const ip = client();
    const post = (data: unknown, origin: string | null = ORIGIN) =>
      request.post("/api/subscribe", { data, headers: { "content-type": "application/json", ...ip, ...(origin ? { origin } : {}) } });
    const bot = await post({ name: "Bot", email: unique(), lang: "en", website: "http://spam.example" });
    expect(bot.status()).toBe(200);
    expect(await bot.json()).toEqual({ ok: true });
    expect((await post({ name: "A", email: unique() }, "https://evil.example")).status()).toBe(403);
    expect((await post({ name: "A", email: "not-an-email" })).status()).toBe(400);
    expect((await post({ name: "", email: unique() })).status()).toBe(400);
    expect((await post({ name: "x".repeat(3000), email: unique() })).status()).toBe(413);
  });
});

test.describe("layout", () => {
  for (const width of [360, 768, 1280]) {
    for (const path of ["/mn/events", `/mn/events/${KD}`, "/en/about"]) {
      test(`no horizontal overflow on ${path} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.locator("h1").first().waitFor({ state: "attached" });
        await page.waitForLoadState("networkidle");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      });
    }
  }
});

test.describe("about page members", () => {
  test("lists members from the database without any e-mail address", async ({ page }) => {
    await page.goto("/en/about");
    const cards = page.locator("[data-member]:not([hidden])");
    await expect(cards.first()).toBeVisible();
    expect(await page.content()).not.toMatch(/@example\.(com|edu\.mn)/);
  });
});
