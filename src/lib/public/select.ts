// Pure selectors for the public site: they take a Db (plus a clock) and return only what visitors may see.
// No cookies, no cache, no I/O, so they are unit-tested directly (tests/unit/public-select.test.ts).
import { tf, type L } from "@/i18n/config";
import { INSTAGRAM, type Milestone, type Shot } from "@/lib/club";
import type { Event, EventDetail } from "@/lib/events";
import type { StickerName } from "@/lib/manul";
import { goingCount, publicEvents } from "@/lib/mockdb/queries";
import type { Db, EventKind, EventRow, Registration } from "@/lib/mockdb/types";
import { UB_TZ } from "@/lib/time";
import type { Member, PublicAttendee, SeatInfo, TimelineMedia } from "./types";

const KIND_KEY: Record<EventKind, string> = {
  hackathon: "Hackathon", competition: "Competition", workshop: "Workshop", meetup: "Meetup", knowledge_day: "Knowledge Day", outing: "Outing", other: "Other",
};
const KIND_STICKER: Record<EventKind, StickerName> = {
  hackathon: "coffee", competition: "torch", workshop: "laptop", meetup: "wave", knowledge_day: "yell", outing: "roll", other: "smug",
};
// The archived events keep the Manul they always had on the static site.
const SLUG_STICKER: Record<string, StickerName> = {
  "hackathon-2018": "grumpy", "opendata-hackathon-2019": "grumpy", "digital-hackathon-2019": "torch", "online-hackathon-2020": "sleepy",
  "digital-num-appathon-2023": "wave", "xacbank-hackathon-2024": "smug", "c-battle-2025": "torch", "typerace-2026": "laptop",
  "dev-hackathon-2025": "coffee", "num-startup-3-2023": "yell",
};

export type EventPhase = "ended" | "live" | "full" | "open" | "upcoming" | "cancelled";
const ENDED: readonly string[] = ["completed", "archived"];

const ubYear = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: UB_TZ, year: "numeric" }).format(new Date(iso));

/** Where an event is in its life, for the list badge. (The registration panel has its own, viewer-specific logic.) */
export function eventPhase(db: Db, ev: EventRow, now: Date): EventPhase {
  if (ev.status === "cancelled") return "cancelled";
  if (ENDED.includes(ev.status) || now >= new Date(ev.ends_at)) return "ended";
  if (now >= new Date(ev.starts_at)) return "live";
  if (ev.audience === "invite") return "upcoming";
  if ((ev.reg_opens_at && now < new Date(ev.reg_opens_at)) || (ev.reg_closes_at && now > new Date(ev.reg_closes_at))) return "upcoming";
  if (ev.reg_mode === "rsvp" && ev.capacity !== null && goingCount(db, ev.id) >= ev.capacity) return "full";
  return "open";
}
const PHASE_LABEL: Record<EventPhase, string> = { ended: "Ended", live: "Live", full: "Full", open: "Open", upcoming: "Soon", cancelled: "Cancelled" };

const modeKey = (m: EventRow["mode"]) => (m === "online" ? "Online" : m === "hybrid" ? "Hybrid" : "Offline");

/** Event row → the list shape. A missing English title/tagline falls back to the Mongolian one (spec rule). */
export function toEvent(db: Db, ev: EventRow, now: Date): Event {
  const phase = eventPhase(db, ev, now);
  return {
    slug: ev.slug,
    name: { mn: ev.title.mn, en: tf(ev.title, "en") },
    tagline: { mn: ev.tagline.mn, en: tf(ev.tagline, "en") },
    year: ubYear(ev.starts_at),
    mode: modeKey(ev.mode),
    themes: [KIND_KEY[ev.kind]],
    status: PHASE_LABEL[phase],
    participants: ev.legacy_participants,
    url: ev.external_url ?? (phase === "ended" ? INSTAGRAM : ""),
    sticker: SLUG_STICKER[ev.slug] ?? KIND_STICKER[ev.kind],
  };
}

export function toEventDetail(db: Db, ev: EventRow, now: Date): EventDetail {
  return {
    ...toEvent(db, ev, now),
    id: ev.id,
    description: { mn: ev.description.mn, en: tf(ev.description, "en") },
    startsAt: ev.starts_at,
    endsAt: ev.ends_at,
    approximateDate: ev.approximate_date,
    venue: ev.venue_name,
    address: ev.venue_address,
    audience: ev.audience,
    regMode: ev.reg_mode,
    capacity: ev.capacity,
    waitlist: ev.waitlist,
    regOpensAt: ev.reg_opens_at,
    regClosesAt: ev.reg_closes_at,
    decisionDeadline: ev.decision_deadline,
    cancelled: ev.status === "cancelled",
  };
}

/** Published, completed and archived events: upcoming ones first (soonest first), then past ones (latest first). */
export function listEvents(db: Db, now: Date): Event[] {
  const rows = publicEvents(db);
  const upcoming = rows.filter((e) => new Date(e.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = rows.filter((e) => new Date(e.ends_at) <= now); // already latest first
  return [...upcoming, ...past].map((e) => toEvent(db, e, now));
}

/** A single event for its page. Drafts are invisible; a cancelled event is still reachable by its link. */
export function eventDetail(db: Db, slug: string, now: Date): EventDetail | null {
  const ev = db.events.find((e) => e.slug === slug);
  if (!ev || ev.status === "draft") return null;
  return toEventDetail(db, ev, now);
}

export const publicSlugs = (db: Db) => publicEvents(db).map((e) => e.slug);

/** Counts only: safe for anyone to see. */
export function seatInfo(db: Db, ev: EventRow): SeatInfo {
  const going = goingCount(db, ev.id);
  const waitlisted = db.registrations.filter((r) => r.event_id === ev.id && r.status === "waitlisted").length;
  const left = ev.capacity === null ? null : Math.max(0, ev.capacity - going);
  return { going, waitlisted, capacity: ev.capacity, left, full: left === 0 };
}

/** People with a seat who chose a public profile, most recent first. Everyone else is only counted, never named. */
export function publicAttendees(db: Db, eventId: string, limit: number): { shown: PublicAttendee[]; more: number } {
  const seated = db.registrations
    .filter((r) => r.event_id === eventId && (r.status === "going" || r.status === "attended"))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const people = seated.flatMap((r: Registration) => {
    const p = db.profiles.find((x) => x.id === r.profile_id);
    return p && !p.deleted_at && p.visibility === "public" ? [{ id: p.id, name: p.name }] : [];
  });
  return { shown: people.slice(0, limit), more: Math.max(0, people.length - limit) };
}

/** 1-based place in the waitlist, in the order seats are handed out (earliest sign-up first). Null when not waitlisted. */
export function waitlistPosition(db: Db, eventId: string, profileId: string): number | null {
  const line = db.registrations.filter((r) => r.event_id === eventId && r.status === "waitlisted").sort((a, b) => a.created_at.localeCompare(b.created_at));
  const i = line.findIndex((r) => r.profile_id === profileId);
  return i < 0 ? null : i + 1;
}

/**
 * Members page: one card per person per season, only for profiles that chose a public profile (unclaimed legacy
 * profiles are public by default). Seasons after the current one (applications still open) are not listed.
 */
export function publicMembers(db: Db): { members: Member[]; seasons: number[]; current: number | null } {
  const current = db.seasons.find((s) => s.is_current)?.year ?? null;
  const members: Member[] = [];
  for (const m of db.memberships) {
    if (current !== null && m.season > current) continue;
    const p = db.profiles.find((x) => x.id === m.profile_id);
    if (!p || p.deleted_at || p.visibility !== "public" || !(p.name.mn.trim() || p.name.en.trim())) continue;
    members.push({
      id: `${p.id}:${m.season}`,
      name: { mn: tf(p.name, "mn") || p.name.en, en: tf(p.name, "en") },
      role: m.role_title,
      team: m.team,
      season: m.season,
      ...(p.avatar_path?.startsWith("/img/") ? { photo: p.avatar_path } : {}),
    });
  }
  // Newest season first; inside a season people with a title lead, then alphabetical.
  members.sort((a, b) => b.season - a.season || Number(!!b.role) - Number(!!a.role) || a.name.en.localeCompare(b.name.en));
  const seasons = [...new Set(members.map((m) => m.season))].sort((a, b) => b - a);
  return { members, seasons, current };
}

const isPoster = (path: string) => path.includes("/posters/");
/** Timeline rows (oldest first) and, per year, the front card and the card peeking out behind it. */
export function publicTimeline(db: Db): { items: Milestone[]; media: TimelineMedia } {
  const rows = [...db.timeline_milestones].sort((a, b) => a.year - b.year || a.sort - b.sort);
  const items: Milestone[] = rows.map((r) => ({ year: r.year, title: r.title, ...(r.note ? { note: r.note } : {}), ...(r.url ? { url: r.url } : {}) }));
  const media: TimelineMedia = {};
  for (const r of rows) {
    const shots: Shot[] = [r.front_path, r.back_path].flatMap((src) => (src ? [{ src, alt: r.title as L, kind: isPoster(src) ? ("poster" as const) : ("photo" as const) }] : []));
    for (const s of shots) {
      const cur = media[r.year];
      if (!cur) media[r.year] = { front: s };
      else if (!cur.back && cur.front.src !== s.src) media[r.year] = { ...cur, back: s };
    }
  }
  return { items, media };
}
