import { connection } from "next/server";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { getSession } from "@/lib/server/session";

/**
 * Put the local demo database back to its seed. Mock mode only (404 otherwise), same-site only, and only for the admin
 * persona. Used by the e2e suite to start stateful specs from a known state; the admin "Reset demo data" button does the same.
 */
export async function POST(req: Request) {
  await connection();
  if (!mockEnabled()) return new Response(null, { status: 404 });
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  let sameSite = false;
  try { sameSite = !!origin && !!host && new URL(origin).host === host; } catch { sameSite = false; }
  if (!sameSite) return new Response(null, { status: 403 });
  const session = await getSession();
  if (session?.staffRole !== "admin") return new Response(null, { status: 403 });
  getStore().reset();
  return new Response(null, { status: 204 });
}
