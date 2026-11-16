import { connection, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { getStore } from "@/lib/mockdb/store";
import { eventIcs } from "@/lib/public/calendar";

/** GET /api/events/<slug>/ics[?lang=en]: one published (or past) event as a calendar file. Drafts, cancelled and unknown slugs: 404. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/events/[slug]/ics">) {
  await connection();
  const { slug } = await ctx.params;
  const asked = req.nextUrl.searchParams.get("lang") ?? undefined;
  const lang = isLocale(asked) ? asked : "mn";
  const body = eventIcs(getStore().read(), slug, lang); // links use SITE_URL (src/lib/site-url.ts), not the request host
  if (!body) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain; charset=utf-8" } });
  const file = slug.replace(/[^a-z0-9-]/gi, "-").slice(0, 80) || "event";
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}.ics"`,
      "Cache-Control": "private, max-age=900",
    },
  });
}
