import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

/**
 * Navigation guard. For every persona: sign in through the e2e helper, crawl internal links (GET only, same origin,
 * depth <= 3 from where the person lands, one visit per pathname, no /api, no downloads, no clicking of buttons so
 * nothing mutates) and assert that every reachable page renders, has an h1, is quiet in the console, is not a 404
 * unless that is the intended outcome, and is not a dead end.
 *
 * Findings come from docs/superpowers/audits/2026-11-16-user-flows.md. A check that fails today for a real bug is
 * written twice: the failure is filtered out of the green test via KNOWN, and the strict version sits next to it as
 * `test.fixme("F-xx ...")`. Fix the bug, delete the KNOWN entry, flip the fixme to `test`.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const MAX_DEPTH = 3;
const MAX_PAGES = 18; // keeps the whole file well under 90 s on a warm server
const MAX_PER_PATTERN = 2; // /events/<slug>, /admin/events/<id> ... are one template: two samples are enough
const CONCURRENCY = 5;

type Persona = { name: string; handle: string | null; start: string; staff: boolean };
const PERSONAS: Persona[] = [
  { name: "signed-out", handle: null, start: "/en", staff: false },
  { name: "new-guest", handle: "new-guest", start: "/en/me", staff: false },
  { name: "temuulen", handle: "temuulen", start: "/en/me", staff: false },
  { name: "anuujin", handle: "anuujin", start: "/en/me", staff: false },
  { name: "saraa", handle: "saraa", start: "/en/me", staff: false },
  { name: "dev-organizer", handle: "dev-organizer", start: "/en/admin", staff: true },
  { name: "dev-admin", handle: "dev-admin", start: "/en/admin", staff: true },
];

/** A link may lead to a 404 only if it is listed here, with the reason. */
const EXPECTED_404: { path: RegExp; personas: string[]; reason: string }[] = [
  {
    path: /^\/(mn|en)\/admin(\/|$)/,
    personas: ["signed-out", "new-guest", "temuulen", "anuujin", "saraa"],
    reason: "The backoffice is deliberately invisible (ordinary 404) to non-staff. Nothing should link there, but a direct visit must 404.",
  },
];

/** Failures that exist today. key = `${persona}|${pathname}` for pages, `${persona}|console:${id}` for console noise. */
const KNOWN: Record<string, string> = {
};

/** Console errors that are known dev-server findings (the classifier returns the finding id). */
const CONSOLE_KNOWN: { re: RegExp; id: string }[] = [
  { re: /instant-shell-url-data|URL data during prerendering|validate .?instant./i, id: "F-07" },
  { re: /hydrat/i, id: "F-08" },
];
/** Transport noise from dev server restarts and HMR, never a product signal. */
const CONSOLE_IGNORED = /Failed to load resource|WebSocket connection|ERR_CONNECTION|ERR_INCOMPLETE|net::ERR|\[HMR\]/i;

type PageResult = {
  path: string;
  from: string;
  depth: number;
  status: number;
  finalPath: string;
  h1: number;
  notFound: boolean;
  consoleErrors: string[];
  navLinks: number;
  mainActions: number;
  links: string[];
  error?: string;
};

const SKIP_HREF = /^(mailto:|tel:|webcal:|javascript:|#)/;
const SKIP_PATH = /^\/api\/|\/export$|\.(ics|csv|png|jpe?g|webp|svg|pdf|json)$/i;

const normalise = (p: string) => p.replace(/^(\/(?:en|mn)\/(?:admin\/)?events)\/[^/]+/, "$1/:id").replace(/\/(?:e|t)_\w+/g, "/:id");

async function visit(context: BrowserContext, path: string, from: string, depth: number): Promise<PageResult> {
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !CONSOLE_IGNORED.test(m.text())) consoleErrors.push(m.text().slice(0, 240)); });
  page.on("pageerror", (e) => { if (!CONSOLE_IGNORED.test(String(e))) consoleErrors.push(`pageerror: ${String(e).slice(0, 240)}`); });
  const base: PageResult = { path, from, depth, status: 0, finalPath: path, h1: 0, notFound: false, consoleErrors, navLinks: 0, mainActions: 0, links: [] };
  try {
    let status = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await page.goto(BASE + path, { waitUntil: "load", timeout: 45_000 });
        status = res?.status() ?? 0;
        if (status < 500) break;
      } catch (e) {
        if (attempt === 1) throw e;
      }
      await page.waitForTimeout(4_000); // dev server restarting or compiling: retry once, report only if it persists
    }
    await page.waitForTimeout(400); // let streamed Suspense content and client redirects settle
    const info = await page.evaluate(() => {
      const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
      const h1s = [...document.querySelectorAll("h1")].filter(visible);
      const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
      return {
        h1: h1s.length,
        h1Text: h1s.map((h) => h.textContent ?? "").join(" "),
        title: document.title,
        navLinks: links.filter((a) => a.closest("nav, header, footer, aside") && visible(a)).length,
        mainActions: [...document.querySelectorAll("main a[href], main button")].filter(visible).length,
        hrefs: links.map((a) => a.href),
        location: location.pathname + location.search,
      };
    });
    const url = new URL(page.url());
    return {
      ...base, status, finalPath: info.location, h1: info.h1,
      notFound: status === 404 || /not found|404/i.test(info.h1Text) || /page not found/i.test(info.title),
      navLinks: info.navLinks, mainActions: info.mainActions,
      links: info.hrefs.filter((h) => { try { return new URL(h).origin === url.origin; } catch { return false; } }),
    };
  } catch (e) {
    return { ...base, error: String(e).slice(0, 200) };
  } finally {
    await page.close();
  }
}

async function crawl(browser: Browser, persona: Persona): Promise<PageResult[]> {
  const context = await browser.newContext({ baseURL: BASE, viewport: { width: 1280, height: 800 } });
  const auth = await context.newPage();
  await signInAs(auth, persona.handle);
  await auth.close();
  const seen = new Set<string>();
  const perPattern = new Map<string, number>();
  const results: PageResult[] = [];
  let frontier: { path: string; from: string }[] = [{ path: persona.start, from: "(start)" }];
  try {
    for (let depth = 0; depth <= MAX_DEPTH && frontier.length && results.length < MAX_PAGES; depth++) {
      const batch = frontier.filter((f) => {
        const pathname = f.path.split("?")[0];
        const pattern = normalise(pathname);
        if (seen.has(pathname) || (perPattern.get(pattern) ?? 0) >= MAX_PER_PATTERN) return false;
        seen.add(pathname);
        perPattern.set(pattern, (perPattern.get(pattern) ?? 0) + 1);
        return true;
      }).slice(0, MAX_PAGES - results.length);
      const done: PageResult[] = [];
      for (let i = 0; i < batch.length; i += CONCURRENCY) {
        done.push(...(await Promise.all(batch.slice(i, i + CONCURRENCY).map((f) => visit(context, f.path, f.from, depth)))));
      }
      results.push(...done);
      const next: { path: string; from: string }[] = [];
      for (const r of done) {
        if (r.error || r.notFound) continue;
        for (const href of r.links) {
          const u = new URL(href);
          if (SKIP_HREF.test(href) || SKIP_PATH.test(u.pathname)) continue;
          if (!u.pathname.startsWith("/en")) continue; // /mn is spot-checked by the language test below
          next.push({ path: u.pathname + u.search, from: r.path });
        }
      }
      frontier = next;
    }
  } finally {
    await context.close();
  }
  return results;
}

const isExpected404 = (persona: string, path: string) => EXPECTED_404.some((e) => e.path.test(path) && e.personas.includes(persona));
const known = (persona: string, path: string) => KNOWN[`${persona}|${path.split("?")[0]}`] ?? KNOWN[`*|${path.split("?")[0]}`];
const consoleId = (msg: string) => CONSOLE_KNOWN.find((k) => k.re.test(msg))?.id ?? null;

for (const persona of PERSONAS) {
  test.describe(`nav crawl: ${persona.name}`, () => {
    test.describe.configure({ mode: "serial" });
    let pages: PageResult[] = [];
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(150_000);
      pages = await crawl(browser, persona);
    });

    test("every reachable page renders (no 5xx, no load error)", () => {
      expect(pages.length, "the crawl found nothing to visit").toBeGreaterThan(0);
      const bad = pages.filter((p) => p.error || p.status >= 500).map((p) => `${p.path} -> ${p.error ?? p.status} (from ${p.from})`);
      expect(bad).toEqual([]);
    });

    test("every page has an h1", () => {
      const bad = pages.filter((p) => !p.error && p.h1 === 0).map((p) => `${p.path} (from ${p.from})`);
      expect(bad).toEqual([]);
    });

    test("no console.error other than the tracked dev findings", () => {
      const bad = pages.flatMap((p) => p.consoleErrors.filter((m) => consoleId(m) === null).map((m) => `${p.path}: ${m}`));
      expect(bad).toEqual([]);
    });

    test("no link leads to a 404 unless it is expected or tracked", () => {
      const bad = pages
        .filter((p) => p.notFound && !isExpected404(persona.name, p.path) && !known(persona.name, p.path))
        .map((p) => `${p.path} is a 404 (linked from ${p.from})`);
      expect(bad).toEqual([]);
    });

    test("no page is a dead end (navigation landmark with at least one link)", () => {
      const bad = pages.filter((p) => !p.error && p.navLinks === 0).map((p) => `${p.path} has no nav/header/footer link`);
      expect(bad).toEqual([]);
    });

    test("main content offers a way forward (link or button)", () => {
      const bad = pages
        .filter((p) => !p.error && !p.notFound && p.mainActions === 0 && !known(persona.name, p.path))
        .map((p) => `${p.path} has nothing to click inside <main>`);
      expect(bad).toEqual([]);
    });

    // Strict versions of the tracked failures. Un-fixme once the finding is fixed and delete its KNOWN entry.
    test(`F-07 no instant-shell console.error on any page (${persona.name})`, () => {
      const bad = pages.flatMap((p) => p.consoleErrors.filter((m) => consoleId(m) === "F-07").map((m) => `${p.path}: ${m.slice(0, 80)}`));
      expect(bad).toEqual([]);
    });
    test(`F-08 no hydration console.error on any page (${persona.name})`, () => {
      const bad = pages.flatMap((p) => p.consoleErrors.filter((m) => consoleId(m) === "F-08").map((m) => `${p.path}: ${m.slice(0, 80)}`));
      expect(bad).toEqual([]);
    });
    if (persona.name === "dev-organizer") {
      test("F-04 the organizer is never linked to a page that 404s", () => {
        const bad = pages.filter((p) => p.notFound).map((p) => `${p.path} (linked from ${p.from})`);
        expect(bad).toEqual([]);
      });
    }
    if (persona.name === "signed-out") {
      test("F-10 the Code of Conduct page offers a way to report a problem or move on", () => {
        const p = pages.find((x) => x.path === "/en/code-of-conduct");
        expect(p, "code of conduct not reached by the crawl").toBeTruthy();
        expect(p?.mainActions).toBeGreaterThan(0);
      });
    }
    if (persona.name === "anuujin") {
      test("F-02b /en/me/membership gives a member something to do next", () => {
        const p = pages.find((x) => x.path === "/en/me/membership");
        expect(p, "membership page not reached by the crawl").toBeTruthy();
        expect(p?.mainActions).toBeGreaterThan(0);
      });
    }
  });
}

test.describe("nav behaviours that are not link crawling", () => {
  const status = async (page: Page, path: string) => (await page.request.get(BASE + path, { maxRedirects: 0 })).status();

  test("language switch keeps the page (path)", async ({ page }) => {
    await signInAs(page, "dev-admin");
    for (const path of ["/en/admin/events", "/en/admin/members", "/en/admin/comms", "/en/events/knowledge-day-rag"]) {
      await page.goto(path);
      const target = await page.locator("a[hreflang='mn']").first().getAttribute("href");
      expect(target, path).toBe(path.replace(/^\/en/, "/mn"));
    }
  });

  test("F-09 language switch keeps the query string (filters)", async ({ page }) => {
    await signInAs(page, "dev-admin");
    await page.goto("/en/admin/comms?status=failed");
    expect(await page.locator("a[hreflang='mn']").first().getAttribute("href")).toBe("/mn/admin/comms?status=failed");
  });

  test("a wrong-role visit to the backoffice shows the 404 page", async ({ page }) => {
    await signInAs(page, "anuujin");
    await page.goto("/en/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/not found/i);
  });

  test("an organizer gets the 404 page on /en/admin/settings", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await page.goto("/en/admin/settings");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/not found/i);
  });

  test("F-03 signed out, /en/admin redirects to sign-in with next", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Fadmin/);
  });

  test("signed out, /en/me redirects to sign-in with next", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en/me");
    await expect(page).toHaveURL(/\/en\/sign-in\?next=%2Fen%2Fme/);
  });

  test("unknown event slug is a real 404 status", async ({ page }) => {
    expect(await status(page, "/en/events/no-such-event-audit")).toBe(404);
  });

  test("F-05 a page that renders 'not found' also answers 404 (not 200)", async ({ page }) => {
    await signInAs(page, "anuujin");
    expect(await status(page, "/en/admin")).toBe(404);
  });

  test("F-01 the public header offers sign in (signed out) or an account entry (signed in)", async ({ page }) => {
    await signInAs(page, null);
    await page.goto("/en");
    await expect(page.locator("header").getByRole("link", { name: /sign in|нэвтрэх/i })).toBeVisible();
    await signInAs(page, "anuujin");
    await page.goto("/en");
    await expect(page.locator("header").getByRole("link", { name: /my hackum|profile|account|dashboard|миний/i })).toBeVisible();
  });

  test("F-02 a guest from another school can change school from where the membership page sends them", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/membership");
    await page.getByRole("link", { name: /update school/i }).click();
    await expect(page.getByLabel(/school/i).first()).toBeEditable();
  });
});
