import type { APIRequestContext } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;

/** Put the demo database back to its seed (admin-only dev endpoint). Specs that need a known starting state call this first. */
export async function resetDemo(request: APIRequestContext) {
  const res = await request.post(`${BASE}/api/dev/reset`, { headers: { Origin: BASE, Cookie: "hackum-dev-as=dev-admin" } });
  if (res.status() !== 204) throw new Error(`demo reset failed with ${res.status()}`);
}
