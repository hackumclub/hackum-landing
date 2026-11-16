// Visual contract of the member event card and the Home ticket (Home, Events tabs) at phone and laptop width:
// posters are shown whole, nothing is drawn over them, actions stay on one line, helper text has normal leading,
// no horizontal scroll, axe clean in both themes. Reads whatever the shared demo data has: never asserts counts.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "./helpers/as";

const PAGES = ["/en/me", "/en/me/events?tab=going", "/en/me/events?tab=upcoming", "/en/me/events?tab=past"];
const SIZES = [{ width: 390, height: 844 }, { width: 1280, height: 900 }];

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("main h1").first().waitFor();
  await page.waitForLoadState("networkidle");
}

for (const viewport of SIZES) {
  test.describe(`event cards at ${viewport.width}px`, () => {
    test.use({ viewport });
    test.beforeEach(async ({ page }) => { await signInAs(page, "anuujin"); });

    test("posters use object-fit: contain and keep their reserved space", async ({ page }) => {
      let seen = 0;
      for (const path of PAGES) {
        await open(page, path);
        const info = await page.$$eval("[data-poster]", (slots) => slots.map((slot) => {
          const img = slot.querySelector<HTMLImageElement>("img[data-poster-img]");
          const box = slot.getBoundingClientRect();
          return { fit: img ? getComputedStyle(img).objectFit : null, w: box.width, h: box.height };
        }));
        for (const p of info) {
          if (p.fit !== null) { seen++; expect(p.fit).toBe("contain"); }
          expect(p.w).toBeGreaterThan(100);
          expect(p.h).toBeGreaterThan(100); // a fixed aspect / min height: never collapses while the image loads
        }
      }
      expect(seen).toBeGreaterThan(0); // the seeded past events always carry posters
    });

    test("nothing in a card overlaps its poster", async ({ page }) => {
      for (const path of PAGES) {
        await open(page, path);
        const overlaps = await page.$$eval("article:has([data-poster])", (cards) => cards.flatMap((card) => {
          const slot = card.querySelector("[data-poster]")!;
          const r = slot.getBoundingClientRect();
          return [...card.querySelectorAll("*")]
            .filter((el) => !slot.contains(el) && !el.contains(slot))
            .filter((el) => {
              const b = el.getBoundingClientRect();
              if (b.width === 0 || b.height === 0) return false;
              const w = Math.min(b.right, r.right) - Math.max(b.left, r.left);
              const h = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
              return w > 1 && h > 1;
            })
            .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
        }));
        expect(overlaps, path).toEqual([]);
      }
    });

    test("actions are pills that stay on one line (≤ 48 px high, ≥ 44 px tap target)", async ({ page }) => {
      for (const path of PAGES) {
        await open(page, path);
        const heights = await page.$$eval("article:has([data-poster]) :is(button, a)[class*='rounded-full']", (els) =>
          els.filter((el) => el.getBoundingClientRect().width > 0).map((el) => ({ t: (el.textContent ?? "").trim(), h: Math.round(el.getBoundingClientRect().height) })));
        for (const x of heights) {
          expect(x.h, `${path} "${x.t}"`).toBeLessThanOrEqual(48);
          expect(x.h, `${path} "${x.t}"`).toBeGreaterThanOrEqual(44);
        }
      }
    });

    test("the calendar helper sentence has normal leading and no horizontal scroll", async ({ page }) => {
      for (const path of PAGES) {
        await open(page, path);
        const helper = page.getByText("update in your calendar automatically").first();
        if (await helper.count()) {
          const ratio = await helper.evaluate((el) => {
            const cs = getComputedStyle(el);
            return Number.parseFloat(cs.lineHeight) / Number.parseFloat(cs.fontSize);
          });
          expect(ratio).toBeLessThanOrEqual(1.6);
          expect(ratio).toBeGreaterThanOrEqual(1.2);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });

    for (const scheme of ["light", "dark"] as const) {
      test(`axe: no WCAG 2.2 A/AA violations on Home and Events (${scheme})`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        for (const path of PAGES) {
          await open(page, path);
          const { violations } = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
            .exclude("nextjs-portal") // Next dev-tools overlay, not ours
            .analyze();
          expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`), path).toEqual([]);
        }
      });
    }
  });
}
