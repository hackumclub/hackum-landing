// Persona x route table from the v2 spec (section 3): what each kind of visitor gets from each route, with honest HTTP
// statuses. Raw requests (no browser) for everything the proxy decides; a browser only for the redirects a page itself
// performs and for what the page says. Read-only: nothing here writes to the shared demo database.
import { expect, test, type APIRequestContext } from "@playwright/test";
import { signInAs } from "./helpers/as";

type Who = "signed-out" | "new-guest" | "temuulen" | "anuujin" | "saraa" | "bayar" | "dev-organizer" | "dev-admin";
const PERSONAS: Who[] = ["signed-out", "new-guest", "temuulen", "anuujin", "saraa", "bayar", "dev-organizer", "dev-admin"];
const MEMBERS: Who[] = ["new-guest", "temuulen", "anuujin", "saraa", "bayar"];
const STAFF: Who[] = ["dev-organizer", "dev-admin"];

const PUBLIC = ["/en", "/en/events", "/en/about", "/en/join", "/en/sign-in", "/mn", "/mn/events"];
const ME = ["/en/me", "/en/me/events", "/en/me/membership", "/en/me/profile", "/en/me/notifications", "/en/me/settings", "/en/me/onboarding"];
const ADMIN = ["/en/admin", "/en/admin/events", "/en/admin/members", "/en/admin/forms", "/en/admin/analytics", "/en/admin/comms", "/en/admin/inbox"];
const ADMIN_ONLY = ["/en/admin/settings", "/en/admin/settings/staff", "/en/admin/settings/integrations", "/en/admin/audit"];

const get = (request: APIRequestContext, path: string, who: Who) =>
  request.get(path, { maxRedirects: 0, headers: who === "signed-out" ? {} : { Cookie: `hackum-dev-as=${who}` } });
const signIn = (path: string) => `${path.slice(0, 3)}/sign-in?next=${encodeURIComponent(path)}`;
const rel = (loc: string) => { const u = new URL(loc, "http://x"); return u.pathname + u.search; };

/** The expected raw outcome of `path` for `who`: a status, plus the redirect target when it is a 307. */
function expected(path: string, who: Who): { status: number; location?: string } {
  const area = /^\/(?:en|mn)\/(me|admin)(?:\/|$)/.exec(path)?.[1];
  if (!area) return { status: 200 };
  if (who === "signed-out") return { status: 307, location: signIn(path) };
  if (area === "me") return { status: 200 };
  if (!STAFF.includes(who)) return { status: 404 };
  if (who === "dev-organizer" && ADMIN_ONLY.includes(path)) return { status: 404 };
  return { status: 200 };
}

test.describe("raw status for every persona and route", () => {
  for (const who of PERSONAS) {
    test(`${who}: public, /me and /admin routes answer as the spec says`, async ({ request }) => {
      const routes = [...PUBLIC, ...ME, ...ADMIN, ...ADMIN_ONLY];
      const failures: string[] = [];
      for (const path of routes) {
        const want = expected(path, who);
        const res = await get(request, path, who);
        if (res.status() !== want.status) failures.push(`${path}: ${res.status()} (want ${want.status})`);
        else if (want.location && rel(res.headers().location ?? "") !== want.location) failures.push(`${path}: redirects to ${rel(res.headers().location ?? "")} (want ${want.location})`);
      }
      expect(failures).toEqual([]);
    });
  }

  test("signed-out redirects keep the query inside `next` and the language", async ({ request }) => {
    const q = await get(request, "/en/me/events?tab=going", "signed-out");
    expect(q.status()).toBe(307);
    expect(rel(q.headers().location!)).toBe("/en/sign-in?next=%2Fen%2Fme%2Fevents%3Ftab%3Dgoing");
    const members = await get(request, "/mn/admin/members?tab=applications", "signed-out");
    expect(rel(members.headers().location!)).toBe("/mn/sign-in?next=%2Fmn%2Fadmin%2Fmembers%3Ftab%3Dapplications");
  });

  test("the old members sub-routes are real redirects only after the guard (staff), 404 for members", async ({ request }) => {
    for (const who of MEMBERS) {
      expect((await get(request, "/en/admin/members/applications", who)).status(), who).toBe(404);
      expect((await get(request, "/en/admin/members/merge", who)).status(), who).toBe(404);
    }
    expect((await get(request, "/en/admin/members/applications", "signed-out")).status()).toBe(307);
  });

  test("a member never learns that /admin exists: the same 404 page as any unknown route", async ({ request }) => {
    const admin = await (await get(request, "/en/admin/audit", "anuujin")).text();
    const unknown = await (await get(request, "/en/definitely-not-a-page", "anuujin")).text();
    expect(admin).toMatch(/not found/i);
    expect(admin).not.toMatch(/Audit log|Members|Comms/);
    expect(unknown).toMatch(/not found/i);
  });

  test("an unknown public event slug is a real 404", async ({ request }) => {
    expect((await get(request, "/en/events/no-such-event-matrix", "signed-out")).status()).toBe(404);
  });

  test("an unknown admin event id is a real 404", async ({ request }) => {
    expect((await get(request, "/en/admin/events/no-such-id", "dev-admin")).status()).toBe(404);
  });
});

test.describe("what the page itself does", () => {
  test("`bayar` (NUM guest) opens /me/membership with 200 and is NOT told membership is closed to them", async ({ page, request }) => {
    expect((await get(request, "/en/me/membership", "bayar")).status()).toBe(200);
    await signInAs(page, "bayar");
    await page.goto("/en/me/membership");
    await page.locator("main h1").first().waitFor();
    await expect(page.getByText("Membership is for NUM students")).toHaveCount(0);
  });

  test("`temuulen` (another school) sees the eligibility card on /me/membership", async ({ page }) => {
    await signInAs(page, "temuulen");
    await page.goto("/en/me/membership");
    await expect(page.getByText("Membership is for NUM students")).toBeVisible();
  });

  test("`anuujin` and `saraa` open /me/membership (200) without the eligibility card", async ({ page, request }) => {
    for (const who of ["anuujin", "saraa"] as const) {
      expect((await get(request, "/en/me/membership", who)).status(), who).toBe(200);
      await signInAs(page, who);
      await page.goto("/en/me/membership");
      await page.locator("main h1").first().waitFor();
      await expect(page.getByText("Membership is for NUM students")).toHaveCount(0);
    }
  });

  test("a new guest is taken to onboarding, an onboarded member is not", async ({ page }) => {
    await signInAs(page, "new-guest");
    await page.goto("/en/me");
    await page.waitForLoadState("networkidle");
    // Parallel specs can onboard `new-guest`; the assertion only applies while the persona is still new.
    const stillNew = /\/me\/onboarding/.test(page.url());
    test.skip(!stillNew, "new-guest has been onboarded in this database");
    expect(page.url()).toContain("next=%2Fen%2Fme");
    await signInAs(page, "anuujin");
    await page.goto("/en/me");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/onboarding");
  });

  test("staff land on the dashboard from sign-in; an organizer sees no Settings or Audit link", async ({ page }) => {
    await signInAs(page, "dev-organizer");
    await page.goto("/en/admin");
    const nav = page.getByRole("navigation", { name: "Admin menu" }).first();
    await expect(nav.getByRole("link", { name: "Members" })).toBeVisible();
    for (const name of ["Settings", "Audit log"]) await expect(nav.getByRole("link", { name })).toHaveCount(0);
  });
});
