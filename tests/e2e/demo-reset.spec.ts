import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers/as";
import { resetDemo } from "./helpers/reset";

const BASE = `http://localhost:${Number(process.env.E2E_PORT ?? 3100)}`;

test.describe("POST /api/dev/reset", () => {
  test("is refused for anyone who is not an admin, and for cross-site requests", async ({ request }) => {
    const anon = await request.post(`${BASE}/api/dev/reset`, { headers: { Origin: BASE } });
    expect(anon.status()).toBe(403);
    const member = await request.post(`${BASE}/api/dev/reset`, { headers: { Origin: BASE, Cookie: "hackum-dev-as=anuujin" } });
    expect(member.status()).toBe(403);
    const organizer = await request.post(`${BASE}/api/dev/reset`, { headers: { Origin: BASE, Cookie: "hackum-dev-as=dev-organizer" } });
    expect(organizer.status()).toBe(403);
    const crossSite = await request.post(`${BASE}/api/dev/reset`, { headers: { Origin: "https://evil.example", Cookie: "hackum-dev-as=dev-admin" } });
    expect(crossSite.status()).toBe(403);
  });

  test("restores the seed: a person who finished onboarding is a brand-new guest again", async ({ page, request }) => {
    await resetDemo(request);
    await signInAs(page, "new-guest");
    await page.goto("/en/me");
    await expect(page).toHaveURL(/\/en\/me\/onboarding/);
  });
});
