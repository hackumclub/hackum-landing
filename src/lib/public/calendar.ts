// Calendar feeds for the public site: single-event download, a member's personal feed, the club-wide feed.
// Pure (Db in, ICS text out) so the privacy rules are unit-tested (tests/unit/public-calendar.test.ts).
import { tf, type Locale } from "@/i18n/config";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";
import { SITE_URL } from "@/lib/site-url";
import { publicEvents } from "@/lib/mockdb/queries";
import type { Db, EventRow } from "@/lib/mockdb/types";

export const CLUB_FEED = "club.ics";
export const DEFAULT_ORGANIZER = "noreply@hackum.club";
const SHOWN: readonly string[] = ["published", "completed", "archived"];

export const organizerEmail = () => process.env.EMAIL_ORGANIZER?.trim() || DEFAULT_ORGANIZER;

function location(ev: EventRow, includeOnline: boolean): string {
  if (ev.mode === "online") return includeOnline && ev.online_url ? `Online · ${ev.online_url}` : "Online";
  return [ev.venue_name, ev.venue_address].filter(Boolean).join(", ");
}

export function toIcsEvent(ev: EventRow, o: { lang: Locale; includeOnline?: boolean; origin?: string }): IcsEvent {
  const origin = o.origin ?? SITE_URL;
  const link = `${origin}/${o.lang}/events/${ev.slug}`;
  const text = [tf(ev.tagline, o.lang), tf(ev.description, o.lang)].filter(Boolean).join("\n\n");
  return {
    uid: `${ev.id}@hackum.club`,
    sequence: ev.ics_sequence,
    start: new Date(ev.starts_at),
    end: new Date(ev.ends_at),
    title: tf(ev.title, o.lang),
    description: text ? `${text}\n\n${link}` : link,
    location: location(ev, !!o.includeOnline),
    url: link,
    method: "PUBLISH",
    organizerEmail: organizerEmail(),
  };
}

/** One shown event (published, completed or archived) as a .ics, or null for drafts, cancelled and unknown slugs. */
export function eventIcs(db: Db, slug: string, lang: Locale, origin?: string): string | null {
  const ev = db.events.find((e) => e.slug === slug);
  if (!ev || !SHOWN.includes(ev.status)) return null;
  return buildIcs([toIcsEvent(ev, { lang, origin })], tf(ev.title, lang));
}

/** Everything upcoming and published, for the club-wide subscription. */
export function clubFeedIcs(db: Db, now: Date, lang: Locale, origin?: string): string {
  const upcoming = publicEvents(db).filter((e) => e.status === "published" && new Date(e.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return buildIcs(upcoming.map((e) => toIcsEvent(e, { lang, origin })), "Hackum");
}

/**
 * A person's own feed, found by their secret calendar token: only events they are going to (cancelled
 * registrations, waitlist, applications and cancelled events are left out). Null when the token matches nobody.
 */
export function personalFeedIcs(db: Db, token: string, lang: Locale, origin?: string): string | null {
  if (!token) return null;
  const me = db.profiles.find((p) => p.calendar_token === token && !p.deleted_at);
  if (!me) return null;
  const going = db.registrations.filter((r) => r.profile_id === me.id && r.status === "going");
  const events = going.flatMap((r) => {
    const ev = db.events.find((e) => e.id === r.event_id);
    return ev && SHOWN.includes(ev.status) ? [ev] : [];
  }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return buildIcs(events.map((e) => toIcsEvent(e, { lang, includeOnline: true, origin })), "Hackum");
}

/** Route segment `<calendar_token>.ics` or `club.ics` → the ICS body, or null (the route turns every null into the same 404). */
export function feedForSegment(db: Db, segment: string, now: Date, lang: Locale, origin?: string): string | null {
  if (!segment.endsWith(".ics")) return null;
  if (segment === CLUB_FEED) return clubFeedIcs(db, now, lang, origin);
  return personalFeedIcs(db, segment.slice(0, -".ics".length), lang, origin);
}
