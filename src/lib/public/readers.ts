// Cached readers for the public site. Public data only (see select.ts); the registration panel and the calendar
// routes read the store directly because they are per-person. Every successful write goes through `act()`, which
// calls updateTag("events" | "members" | "timeline"), so these refresh at once; the lifetime below is only a safety net.
// A failing read is logged (WARN, constant message, no data) and answers with an empty result: pages render empty
// states instead of a 500.
import { cacheLife, cacheTag } from "next/cache";
import type { Event, EventDetail } from "@/lib/events";
import { log } from "@/lib/log";
import { getStore } from "@/lib/mockdb/store";
import { eventDetail, listEvents, publicMembers, publicSlugs, publicTimeline } from "./select";
import type { Member, TimelineMedia } from "./types";
import type { Milestone } from "@/lib/club";

export type Loaded<T> = { data: T; failed: boolean };

function guard<T>(reader: string, empty: T, read: () => T): Loaded<T> {
  try {
    return { data: read(), failed: false };
  } catch {
    log("WARN", "public.readers", "public_read_failed", "n/a", { reader });
    return { data: empty, failed: true };
  }
}

export async function getPublicEvents(): Promise<Loaded<Event[]>> {
  "use cache";
  cacheTag("events");
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  return guard("events", [], () => listEvents(getStore().read(), new Date()));
}

export async function getPublicEvent(slug: string): Promise<EventDetail | null> {
  "use cache";
  cacheTag("events");
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  return guard<EventDetail | null>("event", null, () => eventDetail(getStore().read(), slug, new Date())).data;
}

export async function getPublicSlugs(): Promise<string[]> {
  "use cache";
  cacheTag("events");
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  return guard<string[]>("slugs", [], () => publicSlugs(getStore().read())).data;
}

export async function getPublicMembers(): Promise<Loaded<{ members: Member[]; seasons: number[]; current: number | null }>> {
  "use cache";
  cacheTag("members");
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  return guard("members", { members: [], seasons: [], current: null }, () => publicMembers(getStore().read()));
}

export async function getPublicTimeline(): Promise<Loaded<{ items: Milestone[]; media: TimelineMedia }>> {
  "use cache";
  cacheTag("timeline");
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  return guard("timeline", { items: [], media: {} }, () => publicTimeline(getStore().read()));
}
