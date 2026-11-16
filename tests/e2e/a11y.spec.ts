import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const scheme of ["light", "dark"] as const) {
  for (const path of ["/mn/admin", "/en/admin?state=empty", "/en/admin/kit"]) {
    test(`axe: no WCAG 2.2 A/AA violations on ${path} (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.locator("main h1").waitFor();
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude("nextjs-portal") // Next dev-tools overlay, not ours
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
    });
  }
}
