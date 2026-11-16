import { connection, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { getStore } from "@/lib/mockdb/store";
import { feedForSegment } from "@/lib/public/calendar";

// One body and status for every failure (malformed segment, unknown token, deleted person): the response never says
// whether a token exists.
const NOT_FOUND = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });

/** GET /api/calendar/<calendar_token>.ics (that person's going events) or /api/calendar/club.ics (all upcoming published events). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/calendar/[token]">) {
  await connection();
  const { token } = await ctx.params;
  const asked = req.nextUrl.searchParams.get("lang") ?? undefined;
  const body = feedForSegment(getStore().read(), token, new Date(), isLocale(asked) ? asked : "mn", req.nextUrl.origin);
  if (!body) return NOT_FOUND();
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}
