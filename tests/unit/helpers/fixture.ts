import type { Ctx, Db, EventRow, Profile } from "@/lib/mockdb/types";

/** 12:00 in Ulaanbaatar. All rule tests run against this fixed clock. */
export const NOW = new Date("2026-11-16T04:00:00Z");
export const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

export const emptyDb = (): Db => ({
  profiles: [], memberships: [], staff_roles: [], seasons: [], events: [], registrations: [], teams: [],
  membership_applications: [], notifications: [], email_daily_usage: {}, email_suppressions: [], subscribers: [],
  timeline_milestones: [], audit_log: [], profile_semesters: [], seq: 100,
});

export function addProfile(db: Db, over: Partial<Profile> & { id: string }): Profile {
  const p: Profile = {
    clerk_user_id: `user_${over.id}`, email: `${over.id}@example.com`, handle: over.id, name: { mn: `Нэр ${over.id}`, en: `Name ${over.id}` },
    avatar_path: null, school: "МУИС", school_id: "num", major: null, major_track: "cs", program_index: null, passkeys: [], grad_year: 2028, status: "guest", visibility: "public", locale: "mn", links: {},
    notif_prefs: { reminders: true, updates: true, announcements: true }, calendar_token: `tok_${over.id}`,
    onboarded_at: at(-100), created_at: at(-200), last_seen_at: null, deleted_at: null, ...over,
  };
  db.profiles.push(p);
  return p;
}
export const addStaff = (db: Db, id: string, role: "organizer" | "admin") => {
  addProfile(db, { id });
  db.staff_roles.push({ profile_id: id, role, granted_by: null, granted_at: at(-300) });
};

export function addEvent(db: Db, over: Partial<EventRow> & { id: string }): EventRow {
  const e: EventRow = {
    slug: `${over.id}-slug`, kind: "meetup", title: { mn: `Эвент ${over.id}`, en: `Event ${over.id}` }, tagline: { mn: "", en: "" }, description: { mn: "", en: "" },
    starts_at: at(72), ends_at: at(74), tz: "Asia/Ulaanbaatar", approximate_date: false, mode: "offline", venue_name: "МУИС 305", venue_address: null,
    online_url: null, audience: "open", school_scope: "all", capacity: null, waitlist: true, reg_opens_at: null, reg_closes_at: null, status: "published",
    cover_path: null, poster_path: null, themes: [], external_url: null, legacy_participants: null, ics_sequence: 0, reg_mode: "rsvp",
    questions: [], team_mode: "none", team_size_min: 1, team_size_max: 1, decision_deadline: null, created_by: null, created_at: at(-50), ...over,
  };
  db.events.push(e);
  return e;
}

export const ctx = (db: Db, actor: string | null, now: Date = NOW): Ctx => ({ db, actor, now });
export const regOf = (db: Db, eventId: string, profileId: string) => db.registrations.find((r) => r.event_id === eventId && r.profile_id === profileId);
export const statusCount = (db: Db, eventId: string, status: string) => db.registrations.filter((r) => r.event_id === eventId && r.status === status).length;
export const queued = (db: Db, template: string) => db.notifications.filter((n) => n.template === template);
