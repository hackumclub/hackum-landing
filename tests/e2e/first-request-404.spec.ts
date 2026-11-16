import { expect, test } from "@playwright/test";

// A streamed page always starts with 200, so an unknown slug must be rejected BEFORE the page renders (proxy).
// This only fails on the FIRST request for a slug in a production build, so it uses slugs that cannot have been seen.
// Run it against a production server too: E2E_PORT=3101 npx playwright test tests/e2e/first-request-404.spec.ts
const fresh = () => `never-seen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

test("the first request for an unknown event slug is already a 404, in both languages", async ({ request }) => {
  for (const lang of ["mn", "en"]) {
    const res = await request.get(`/${lang}/events/${fresh()}`);
    expect(res.status(), lang).toBe(404);
  }
});

test("a draft event is a 404 on the first request and never reveals its title", async ({ request }) => {
  const res = await request.get("/en/events/c-battle-winter");
  expect(res.status()).toBe(404);
  expect(await res.text()).not.toContain("C Battle");
});

test("real events and malformed paths keep their statuses", async ({ request }) => {
  expect((await request.get("/en/events/knowledge-day-rag")).status()).toBe(200);
  expect((await request.get("/mn/events/%E0%A4%A", { maxRedirects: 0 })).status()).toBe(307);
});
