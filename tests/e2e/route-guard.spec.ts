import { expect, test, type APIRequestContext } from "@playwright/test";

// Raw status and redirect checks (no browser): the proxy answers before any page streams, so the status is honest.
// Findings F-03, F-04, F-05, F-18. The pages and Server Actions re-check on their own (see shells-roles.spec).
const rel = (res: { headers(): Record<string, string> }) => { const u = new URL(res.headers().location, "http://x"); return u.pathname + u.search; };
const get = (request: APIRequestContext, path: string, who: string | null) =>
  request.get(path, { maxRedirects: 0, headers: who ? { Cookie: `hackum-dev-as=${who}` } : {} });

test.describe("signed out", () => {
  test("/en/admin/** is a 307 to sign-in that remembers the page", async ({ request }) => {
    for (const path of ["/en/admin/events", "/en/admin", "/en/admin/settings/staff"]) {
      const res = await get(request, path, null);
      expect(res.status(), path).toBe(307);
      expect(rel(res), path).toBe(`/en/sign-in?next=${encodeURIComponent(path)}`);
    }
  });
  test("/en/me/** is a 307 to sign-in, the query survives in next, and Mongolian stays Mongolian", async ({ request }) => {
    const res = await get(request, "/en/me", null);
    expect(res.status()).toBe(307);
    expect(res.headers().location).toContain("/en/sign-in?next=%2Fen%2Fme");
    const q = await get(request, "/en/me/events?tab=going", null);
    expect(q.headers().location).toContain("next=%2Fen%2Fme%2Fevents%3Ftab%3Dgoing");
    const mn = await get(request, "/mn/admin", null);
    expect(mn.status()).toBe(307);
    expect(rel(mn)).toBe("/mn/sign-in?next=%2Fmn%2Fadmin");
  });
  test("hostile paths never leave this origin: next is data, percent-encoded, behind the fixed sign-in path", async ({ request }) => {
    // Next itself may refuse an encoded slash segment (404); if it reaches the guard, the redirect is the fixed sign-in path.
    const res = await get(request, "/en/me/%2F%2Fevil.com", null);
    expect([307, 404]).toContain(res.status());
    if (res.status() === 307) {
      const loc = res.headers().location;
      expect(loc.startsWith("//")).toBe(false);
      const u = new URL(loc, "http://localhost:3100");
      expect(u.origin).toBe("http://localhost:3100");
      expect(u.pathname).toBe("/en/sign-in");
      expect(u.searchParams.get("next")).toBe("/en/me/%2F%2Fevil.com");
    }
    // a doubled slash is first normalised by Next itself (308 to a single-slash path on this origin), never to another host
    const dbl = await get(request, "/en/admin//evil.com", null);
    expect([307, 308]).toContain(dbl.status());
    expect(dbl.headers().location.startsWith("//")).toBe(false);
    expect(new URL(dbl.headers().location, "http://localhost:3100").origin).toBe("http://localhost:3100");
  });
  test("a cookie naming nobody counts as signed out", async ({ request }) => {
    expect((await get(request, "/en/admin", "no-such-person")).status()).toBe(307);
  });
  test("public pages are untouched", async ({ request }) => {
    for (const path of ["/en", "/en/events", "/en/sign-in"]) expect((await get(request, path, null)).status(), path).toBe(200);
  });
});

test.describe("signed in", () => {
  test("a member on /en/admin/** gets a real 404 (and still opens /en/me)", async ({ request }) => {
    for (const path of ["/en/admin", "/en/admin/events", "/en/admin/inbox"]) expect((await get(request, path, "anuujin")).status(), path).toBe(404);
    expect((await get(request, "/en/me", "anuujin")).status()).toBe(200);
  });
  test("an organizer gets 404 on /admin/audit and /admin/settings/** and 200 elsewhere (F-18)", async ({ request }) => {
    for (const path of ["/en/admin/audit", "/en/admin/settings", "/en/admin/settings/staff", "/en/admin/settings/integrations"]) expect((await get(request, path, "dev-organizer")).status(), path).toBe(404);
    for (const path of ["/en/admin", "/en/admin/events", "/en/admin/members"]) expect((await get(request, path, "dev-organizer")).status(), path).toBe(200);
  });
  test("an unknown form id is a real 404 status, real ones are not (F-05)", async ({ request }) => {
    expect((await get(request, "/en/admin/forms/no-such-form", "dev-organizer")).status()).toBe(404);
    expect((await get(request, "/en/admin/forms/event%3Ae_999999", "dev-organizer")).status()).toBe(404);
    expect((await get(request, "/en/admin/forms/join", "dev-organizer")).status()).toBe(200);
    expect((await get(request, "/en/admin/forms/membership_application", "dev-organizer")).status()).toBe(200);
  });
  test("an admin opens everything", async ({ request }) => {
    for (const path of ["/en/admin", "/en/admin/audit", "/en/admin/settings", "/en/admin/settings/staff"]) expect((await get(request, path, "dev-admin")).status(), path).toBe(200);
  });
  test("the 404 never reveals the backoffice (same page as any unknown route)", async ({ request }) => {
    const body = await (await get(request, "/en/admin/audit", "dev-organizer")).text();
    expect(body).toMatch(/not found/i);
    expect(body).not.toMatch(/Audit log/);
  });
});

test.describe("existing 404 behaviour is kept", () => {
  test("unknown and draft event slugs are still real 404s, real events 200", async ({ request }) => {
    expect((await get(request, "/en/events/no-such-event-guard", null)).status()).toBe(404);
    expect((await get(request, "/en/events/c-battle-winter", null)).status()).toBe(404);
    expect((await get(request, "/en/events/knowledge-day-rag", null)).status()).toBe(200);
  });
});
