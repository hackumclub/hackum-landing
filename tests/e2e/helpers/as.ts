import type { Page } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/** Mock sign-in for e2e: set (or clear) the persona cookie the app reads. Handles: dev-admin, dev-organizer, anuujin, temuulen, saraa, new-guest. */
export async function signInAs(page: Page, handle: string | null) {
  await page.context().clearCookies({ name: "hackum-dev-as" });
  if (handle) await page.context().addCookies([{ name: "hackum-dev-as", value: handle, url: `http://localhost:${PORT}` }]);
}
