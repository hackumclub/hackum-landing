import { connection, type NextRequest } from "next/server";
import { avatarFor } from "@/lib/mockdb/avatars";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { getActorId } from "@/lib/server/session";

const BASE = { "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } as const;
const NO_STORE = { ...BASE, "Cache-Control": "private, no-store" } as const;
const IMMUTABLE = "public, max-age=31536000, immutable";

const notFound = () => new Response("Not found", { status: 404, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });

/**
 * GET /api/avatar/<profileId>[?v=<etag>]: a profile photo, if this viewer may see it (404 otherwise, never 403, so the
 * route does not reveal which profiles have a photo). The URL stored on the profile carries `?v=<etag>`; only a request
 * with the matching version of a *public* photo may sit in a shared cache for a year.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/avatar/[id]">) {
  await connection();
  if (!mockEnabled()) return notFound();
  const { id } = await ctx.params;
  const viewer = await getActorId();
  const found = avatarFor(getStore().read(), id, viewer);
  if (!found) return notFound();

  const version = req.nextUrl.searchParams.get("v");
  const cacheControl = found.cacheable && version === found.etag ? IMMUTABLE : "private, no-store";
  const etag = `"${found.etag}"`;
  const headers = { ...BASE, "Cache-Control": cacheControl, ETag: etag, "Content-Type": found.mime };
  // Access was decided above, so a matching validator may safely answer 304.
  if (req.headers.get("if-none-match")?.split(",").some((v) => v.trim().replace(/^W\//, "") === etag)) return new Response(null, { status: 304, headers });
  return new Response(new Uint8Array(found.bytes), { headers: { ...headers, "Content-Length": String(found.bytes.length) } });
}
