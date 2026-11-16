// Read side of the mock: pure selectors over a Db, shaped like the views/queries the Supabase version will expose
// (public_events, v_event_stats, v_kpis, membership_applications_staff, …).
import type { Db, EventRow, Profile, Registration } from "./types";
import { goingCount, isStaff, profileOf } from "./core";

const PUBLIC_STATUSES = ["published", "completed", "archived"];
const DAY = 86_400_000;

export const publicEvents = (db: Db) => db.events.filter((e) => PUBLIC_STATUSES.includes(e.status)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));

/** One event as a particular viewer may see it: the online link only for people with a seat and for staff; drafts only for staff. */
export function eventForViewer(db: Db, slug: string, viewerId: string | null): EventRow | null {
  const ev = db.events.find((e) => e.slug === slug);
  if (!ev) return null;
  const staff = isStaff(db, viewerId);
  if (!PUBLIC_STATUSES.includes(ev.status) && ev.status !== "cancelled" && !staff) return null;
  const seated = !!viewerId && db.registrations.some((r) => r.event_id === ev.id && r.profile_id === viewerId && (r.status === "going" || r.status === "attended"));
  return { ...ev, online_url: staff || seated ? ev.online_url : null };
}

export function eventStats(db: Db, eventId: string) {
  const regs = db.registrations.filter((r) => r.event_id === eventId);
  const count = (s: Registration["status"]) => regs.filter((r) => r.status === s).length;
  const ev = db.events.find((e) => e.id === eventId);
  const attendees = regs.filter((r) => r.status === "going" || r.status === "attended");
  const returning = attendees.filter((r) =>
    db.registrations.some((o) => o.profile_id === r.profile_id && o.event_id !== eventId && (o.status === "attended" || o.status === "going")
      && (db.events.find((e) => e.id === o.event_id)?.starts_at ?? "") < (ev?.starts_at ?? ""))).length;
  return {
    going: count("going"), waitlisted: count("waitlisted"), applied: count("applied"), rejected: count("rejected"), cancelled: count("cancelled"), attended: count("attended"),
    registered: regs.filter((r) => ["going", "waitlisted", "applied", "attended"].includes(r.status)).length,
    newAttendees: attendees.length - returning, returningAttendees: returning,
  };
}

export function kpis(db: Db, now: Date) {
  const t = now.getTime();
  const rsvps = db.registrations.filter((r) => r.status !== "cancelled");
  const within = (iso: string, from: number, to: number) => { const age = t - new Date(iso).getTime(); return age >= from * DAY && age < to * DAY; };
  const activeIds = new Set(rsvps.filter((r) => within(r.created_at, 0, 90)).map((r) => r.profile_id));
  const active = db.profiles.filter((p) => !p.deleted_at && p.status === "member" && (activeIds.has(p.id) || (p.last_seen_at && within(p.last_seen_at, 0, 90))));
  return {
    activeMembers90d: active.length,
    upcomingEvents: db.events.filter((e) => (e.status === "published" || e.status === "draft") && new Date(e.ends_at) > now).length,
    rsvps30d: rsvps.filter((r) => within(r.created_at, 0, 30)).length,
    rsvpsPrev30d: rsvps.filter((r) => within(r.created_at, 30, 60)).length,
    membersTotal: db.profiles.filter((p) => !p.deleted_at && p.status === "member").length,
    guestsTotal: db.profiles.filter((p) => !p.deleted_at && p.status === "guest").length,
  };
}

export function attentionCounts(db: Db) {
  const live = db.events.filter((e) => e.status === "published" || e.status === "draft");
  return {
    failed_emails: db.notifications.filter((n) => n.status === "failed").length,
    pending_applications: db.registrations.filter((r) => r.status === "applied" && db.events.find((e) => e.id === r.event_id)?.status === "published").length,
    pending_members: db.membership_applications.filter((a) => a.status === "pending").length,
    missing_cover: live.filter((e) => !e.cover_path).length,
    needs_en: live.filter((e) => !e.title.en.trim()).length,
  };
}

export const upcomingEvents = (db: Db, now: Date) =>
  db.events.filter((e) => (e.status === "published" || e.status === "draft") && new Date(e.ends_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));

export function myEvents(db: Db, profileId: string, now: Date) {
  const rows = db.registrations.filter((r) => r.profile_id === profileId).flatMap((registration) => {
    const event = db.events.find((e) => e.id === registration.event_id);
    return event ? [{ event, registration }] : [];
  });
  const over = (e: EventRow) => new Date(e.ends_at) <= now;
  return {
    going: rows.filter((x) => (x.registration.status === "going" || x.registration.status === "waitlisted") && !over(x.event)).sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at)),
    applied: rows.filter((x) => (x.registration.status === "applied" || x.registration.status === "rejected") && !over(x.event)),
    past: rows.filter((x) => over(x.event) && x.registration.status !== "cancelled").sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at)),
    /** Open events the person has not registered for (the "what's next" list). */
    upcoming: db.events.filter((e) => e.status === "published" && !over(e) && e.audience !== "invite" && !rows.some((x) => x.event.id === e.id && x.registration.status !== "cancelled")).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
  };
}

export function membersDirectory(db: Db) {
  const current = db.seasons.find((s) => s.is_current)?.year;
  return db.profiles.filter((p) => !p.deleted_at).map((profile) => {
    const ms = db.memberships.filter((m) => m.profile_id === profile.id);
    return {
      profile,
      seasons: ms.map((m) => m.season).sort((a, b) => a - b),
      team: ms.find((m) => m.season === current)?.team ?? ms.sort((a, b) => b.season - a.season)[0]?.team ?? null,
      eventsAttended: db.registrations.filter((r) => r.profile_id === profile.id && r.status === "attended").length,
      eventsGoing: db.registrations.filter((r) => r.profile_id === profile.id && r.status === "going").length,
    };
  });
}

export function registrationsView(db: Db, eventId: string) {
  return db.registrations.filter((r) => r.event_id === eventId).flatMap((registration) => {
    const profile = profileOf(db, registration.profile_id);
    return profile ? [{ registration, profile, team: registration.team_id ? db.teams.find((t) => t.id === registration.team_id) ?? null : null }] : [];
  });
}

export type DirectoryRow = ReturnType<typeof membersDirectory>[number];
export type PublicProfile = Pick<Profile, "id" | "handle" | "name" | "avatar_path" | "school" | "status">;
export { goingCount };
