import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers/as";

// "Live" as a standalone label (the old connection pill) must be gone everywhere. The SSE refresh itself stays, silent.
// Event-state wording ("Happening now") is allowed; so is the word inside longer copy.
const PAGES: { path: string; as: string | null }[] = [
  { path: "/en", as: null },
  { path: "/en/events", as: null },
  { path: "/en/me", as: "anuujin" },
  { path: "/en/admin", as: "dev-admin" },
];

for (const { path, as } of PAGES) {
  test(`no live pill or pulsing dot on ${path}${as ? ` as ${as}` : ""}`, async ({ page }) => {
    await signInAs(page, as);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    // let the SSE stream connect: the pill used to flip to "Live" at this point
    await page.waitForTimeout(1200);

    const offenders = await page.evaluate(() => {
      const out: string[] = [];
      const label = /^\s*(live|шууд|reconnecting\.*|холбогдож байна…?)\s*$/i;
      for (const el of Array.from(document.body.querySelectorAll("*"))) {
        if (el.children.length === 0 && label.test(el.textContent ?? "")) out.push(`text:${el.textContent?.trim()}`);
        // Loading skeletons are gone once the page settled, so nothing should pulse any more.
        if ((el.getAttribute("class") ?? "").includes("animate-pulse")) out.push(`pulse:${el.getAttribute("class")}`);
      }
      return out;
    });
    expect(offenders).toEqual([]);
    await expect(page.getByRole("status").filter({ hasText: /^\s*(live|reconnecting)/i })).toHaveCount(0);
  });
}
