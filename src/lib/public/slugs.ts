import type { Db } from "@/lib/mockdb/types";

/**
 * Can a visitor open /events/<slug>? Everything except drafts (a cancelled event keeps its page, with a notice).
 * The proxy uses this to answer unknown slugs with a real HTTP 404 *before* anything streams: a streamed page always
 * starts with 200, so notFound() inside it would be a "soft 404" on the first request after a deploy.
 */
export const isVisibleEventSlug = (db: Db, slug: string) => slug !== "" && db.events.some((e) => e.slug === slug && e.status !== "draft");
