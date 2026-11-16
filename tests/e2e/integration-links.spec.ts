import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers/as";

// Cross-area wiring check: every download/feed link shown in /me must actually resolve to a calendar file.
test("every calendar link on /me and /me/events returns a text/calendar file", async ({ page, request }) => {
  await signInAs(page, "anuujin");
  const hrefs = new Set<string>();
  for (const path of ["/en/me", "/en/me/events", "/en/me/settings"]) {
    await page.goto(path);
    await page.locator("main").first().waitFor();
    for (const href of await page.locator('a[href*="/ics"], a[href$=".ics"], a[href*="webcal://"]').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""))) hrefs.add(href);
  }
  const checked = [...hrefs].filter((h) => h.startsWith("/") || h.startsWith("webcal://")).map((h) => (h.startsWith("webcal://") ? h.replace("webcal://", "http://") : h));
  expect(checked.length, "expected at least one calendar link for this persona").toBeGreaterThan(0);
  for (const href of checked) {
    const url = href.startsWith("http") ? new URL(href).pathname : href;
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()["content-type"], url).toContain("text/calendar");
    expect(await res.text(), url).toContain("BEGIN:VCALENDAR");
  }
});
