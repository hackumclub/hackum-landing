// @vitest-environment node
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Answers, Question } from "@/lib/events/questions";
import { PERSONAS, buildSeed } from "@/lib/mockdb/seed";
import type { Db, EventRow, Profile, TemplateName } from "@/lib/mockdb/types";

const NOW = new Date("2026-11-16T05:00:00.000Z");
const DAY = 86_400_000;
const HOUR = 3_600_000;
const db: Db = buildSeed(NOW);

const TEMPLATES: readonly TemplateName[] = [
  "welcome", "rsvp_confirmed", "waitlist_promoted", "waitlist_notice", "application_received", "application_accepted",
  "application_rejected", "membership_approved", "membership_rejected", "event_updated", "event_cancelled", "reminder_24h", "announcement",
];
const TEAMS = ["Marketing", "Dev", "Design", "Events", "Content", "Mentors"];

const ev = (slug: string): EventRow => {
  const e = db.events.find((x) => x.slug === slug);
  if (!e) throw new Error(`missing event ${slug}`);
  return e;
};
const regs = (slug: string, status?: string) => db.registrations.filter((r) => r.event_id === ev(slug).id && (!status || r.status === status));
const prof = (handle: string): Profile => {
  const p = db.profiles.find((x) => x.handle === handle);
  if (!p) throw new Error(`missing profile ${handle}`);
  return p;
};
const dups = (xs: readonly string[]) => xs.length - new Set(xs).size;
const idNum = (id: string) => Number(id.split("_")[1]);
const t = (iso: string) => Date.parse(iso);

/** Mirrors the contract in questions.ts: required answered, select index in range, url parses, no unknown keys. */
function answersValid(questions: Question[], answers: Answers): boolean {
  const ids = new Set(questions.map((q) => q.id));
  if (Object.keys(answers).some((k) => !ids.has(k))) return false;
  return questions.every((q) => {
    const a = answers[q.id];
    if (a === undefined || a === "") return !q.required;
    switch (q.type) {
      case "short":
      case "long":
        return typeof a === "string";
      case "url":
        return typeof a === "string" && URL.canParse(a);
      case "select":
        return typeof a === "string" && Number.isInteger(Number(a)) && Number(a) >= 0 && Number(a) < (q.options?.length ?? 0);
      case "multi":
        return Array.isArray(a) && a.every((i) => Number(i) >= 0 && Number(i) < (q.options?.length ?? 0));
      case "checkbox":
        return typeof a === "boolean";
    }
  });
}

describe("determinism", () => {
  it("same now builds deep-equal databases", () => {
    expect(buildSeed(new Date(NOW))).toEqual(db);
  });
  it("different now shifts dates but keeps every count", () => {
    const later = buildSeed(new Date(NOW.getTime() + 9 * DAY));
    expect(JSON.stringify(later)).not.toEqual(JSON.stringify(db));
    expect(ev("knowledge-day-rag").starts_at).not.toEqual(later.events.find((e) => e.slug === "knowledge-day-rag")?.starts_at);
    for (const k of Object.keys(db) as (keyof Db)[]) {
      const a = db[k];
      const b = later[k];
      if (Array.isArray(a) && Array.isArray(b)) expect(b.length).toBe(a.length);
    }
    expect(later.seq).toBe(db.seq);
  });
});

describe("profiles", () => {
  it("has ~140 profiles with the intended status mix", () => {
    expect(db.profiles).toHaveLength(140);
    const by = (s: string) => db.profiles.filter((p) => p.status === s && p.clerk_user_id).length;
    expect(by("member")).toBe(40);
    expect(by("guest")).toBe(72);
    expect(by("alumni")).toBe(20);
  });
  it("has at least 8 unclaimed legacy profiles with no email, onboarded and public", () => {
    const legacy = db.profiles.filter((p) => p.clerk_user_id === null);
    expect(legacy.length).toBeGreaterThanOrEqual(8);
    for (const p of legacy) {
      expect(p.email).toBeNull();
      expect(p.onboarded_at).not.toBeNull();
      expect(p.visibility).toBe("public");
    }
  });
  it("claimed profiles use user_<handle> clerk ids and example.* emails", () => {
    for (const p of db.profiles.filter((x) => x.clerk_user_id)) {
      expect(p.clerk_user_id).toBe(`user_${p.handle}`);
      expect(p.email).toMatch(/^[a-z0-9-]+@example\.(com|edu\.mn)$/);
    }
  });
  it("handles are kebab-case ascii; calendar tokens are unique hex", () => {
    for (const p of db.profiles) {
      expect(p.handle).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(p.calendar_token).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(dups(db.profiles.map((p) => p.handle))).toBe(0);
    expect(dups(db.profiles.map((p) => p.calendar_token))).toBe(0);
    expect(dups(db.profiles.flatMap((p) => (p.email ? [p.email] : [])))).toBe(0);
  });
  it("grad years sit in 2018-2030 and notif_prefs default to all true with a few announcement opt-outs", () => {
    for (const p of db.profiles) if (p.grad_year !== null) expect(p.grad_year >= 2018 && p.grad_year <= 2030).toBe(true);
    const off = db.profiles.filter((p) => !p.notif_prefs.announcements);
    expect(off.length).toBeGreaterThanOrEqual(2);
    expect(off.length).toBeLessThanOrEqual(8);
    for (const p of db.profiles) {
      expect(p.notif_prefs.reminders).toBe(true);
      expect(p.notif_prefs.updates).toBe(true);
    }
  });
  it("uses real Mongolian Cyrillic including Ө and Ү", () => {
    const mn = db.profiles.map((p) => p.name.mn).join(" ");
    expect(mn).toMatch(/Ө/);
    expect(mn).toMatch(/Ү/);
    for (const p of db.profiles.filter((x) => x.handle !== "new-guest")) {
      expect(p.name.mn).toMatch(/^[А-ЯЁӨҮа-яёөү\- ]+$/);
      expect(p.name.en).toMatch(/^[A-Za-z\- ]+$/);
    }
  });
  it("timestamps are never in the future", () => {
    for (const p of db.profiles) {
      expect(t(p.created_at)).toBeLessThanOrEqual(NOW.getTime());
      if (p.last_seen_at) expect(t(p.last_seen_at)).toBeLessThanOrEqual(NOW.getTime());
    }
  });
});

describe("personas", () => {
  it("lists the seven dev personas", () => {
    expect(PERSONAS.map((p) => p.handle)).toEqual(["dev-admin", "dev-organizer", "anuujin", "temuulen", "saraa", "bayar", "new-guest"]);
    for (const p of PERSONAS) {
      expect(p.label.mn.length).toBeGreaterThan(0);
      expect(p.label.en.length).toBeGreaterThan(0);
    }
  });
  it("exist with the stated status, role and onboarding state", () => {
    const roleOf = (h: string) => db.staff_roles.find((r) => r.profile_id === prof(h).id)?.role;
    expect(roleOf("dev-admin")).toBe("admin");
    expect(roleOf("dev-organizer")).toBe("organizer");
    expect(prof("anuujin")).toMatchObject({ status: "member" });
    expect(prof("temuulen")).toMatchObject({ status: "guest" });
    expect(prof("saraa")).toMatchObject({ status: "alumni" });
    expect(prof("bayar")).toMatchObject({ status: "guest", school_id: "num", major_track: "software" });
    expect(prof("temuulen")).toMatchObject({ school_id: "must" });
    for (const h of ["anuujin", "temuulen", "saraa", "dev-admin", "dev-organizer"]) expect(prof(h).onboarded_at).not.toBeNull();
    expect(prof("new-guest")).toMatchObject({ status: "guest", onboarded_at: null, name: { mn: "", en: "" } });
    expect(PERSONAS.find((p) => p.handle === "dev-admin")?.role).toBe("admin");
    expect(PERSONAS.find((p) => p.handle === "dev-organizer")?.role).toBe("organizer");
  });
});

describe("staff, seasons, memberships", () => {
  it("staff roles: one admin, at least two organizers", () => {
    expect(db.staff_roles.filter((r) => r.role === "admin")).toHaveLength(1);
    expect(db.staff_roles.filter((r) => r.role === "organizer").length).toBeGreaterThanOrEqual(2);
  });
  it("seasons 2023..2027 with exactly one current (2026) and an open 2027 window", () => {
    expect(db.seasons.map((s) => s.year)).toEqual([2023, 2024, 2025, 2026, 2027]);
    expect(db.seasons.filter((s) => s.is_current).map((s) => s.year)).toEqual([2026]);
    const s27 = db.seasons.find((s) => s.year === 2027);
    expect(t(s27?.application_opens_at ?? "")).toBe(NOW.getTime() - 14 * DAY);
    expect(t(s27?.application_closes_at ?? "")).toBe(NOW.getTime() + 35 * DAY);
    for (const s of db.seasons.filter((x) => x.year < 2027)) {
      expect(s.application_opens_at).toBeNull();
      expect(s.application_closes_at).toBeNull();
    }
  });
  it("members and alumni hold 1-4 memberships with valid teams; (profile, season) is unique", () => {
    const years = new Set(db.seasons.map((s) => s.year));
    for (const m of db.memberships) {
      expect(years.has(m.season)).toBe(true);
      if (m.team) expect(TEAMS).toContain(m.team);
    }
    expect(dups(db.memberships.map((m) => `${m.profile_id}:${m.season}`))).toBe(0);
    for (const p of db.profiles.filter((x) => x.status !== "guest")) {
      const n = db.memberships.filter((m) => m.profile_id === p.id).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(4);
    }
    expect(db.memberships.some((m) => m.role_title !== null)).toBe(true);
  });
});

describe("events", () => {
  it("has 19 events: 8 archived legacy, the six scenario events and five recent completed ones", () => {
    expect(db.events).toHaveLength(19);
    const legacy = db.events.filter((e) => e.status === "archived");
    expect(legacy).toHaveLength(8);
    for (const e of legacy) {
      expect(e.legacy_participants).toBeGreaterThan(0);
      expect(e.themes.length).toBeGreaterThan(0);
      expect(t(e.ends_at)).toBeLessThan(NOW.getTime());
    }
    expect(legacy.filter((e) => e.approximate_date)).toHaveLength(4);
    const titles = legacy.map((e) => e.title.en);
    for (const x of ["Hackathon 2018", "OpenData Hackathon 2019", "Digital Hackathon 2019", "Online Hackathon 2020", "Digital NUM Appathon 2023", "XacBank Hackathon 2024", "C Battle 2025", "Typerace 2026"]) expect(titles).toContain(x);
    expect(dups(db.events.map((e) => e.slug))).toBe(0);
  });
  it("knowledge-day-rag: 52 going, 0 waitlisted, 2 cancelled, 18:30 UB in 4 days", () => {
    const e = ev("knowledge-day-rag");
    expect(e).toMatchObject({ kind: "knowledge_day", status: "published", mode: "offline", venue_name: "МУИС · 1-р байр 305", audience: "open", reg_mode: "rsvp", capacity: 60, waitlist: true });
    expect(e.starts_at).toBe("2026-11-20T10:30:00.000Z");
    expect(t(e.ends_at) - t(e.starts_at)).toBe(2 * HOUR);
    expect(regs("knowledge-day-rag", "going")).toHaveLength(52);
    expect(regs("knowledge-day-rag", "waitlisted")).toHaveLength(0);
    expect(regs("knowledge-day-rag", "cancelled")).toHaveLength(2);
    for (const r of regs("knowledge-day-rag", "cancelled")) expect(r.cancelled_at).not.toBeNull();
    expect(regs("knowledge-day-rag").some((r) => prof2(r.profile_id).status === "guest")).toBe(true);
  });
  it("alumni-night: 23 going, no capacity, 19:00 UB in 11 days", () => {
    const e = ev("alumni-night");
    expect(e).toMatchObject({ kind: "meetup", status: "published", capacity: null, reg_mode: "rsvp" });
    expect(e.starts_at).toBe("2026-11-27T11:00:00.000Z");
    expect(regs("alumni-night", "going")).toHaveLength(23);
  });
  it("c-battle-winter: draft, 30 days out, capacity 40, no English title and no cover", () => {
    const e = ev("c-battle-winter");
    expect(e).toMatchObject({ kind: "competition", status: "draft", capacity: 40, reg_mode: "rsvp", cover_path: null });
    expect(e.title.en).toBe("");
    expect(e.title.mn.length).toBeGreaterThan(0);
    expect(t(e.starts_at)).toBeGreaterThan(NOW.getTime() + 29 * DAY);
    expect(t(e.starts_at)).toBeLessThan(NOW.getTime() + 31 * DAY);
  });
  it("devhack-2027: application event with questions, teams, 64 applied and 3 decided", () => {
    const e = ev("devhack-2027");
    expect(e).toMatchObject({ kind: "hackathon", status: "published", reg_mode: "application", capacity: 120, team_mode: "optional", team_size_min: 2, team_size_max: 4 });
    expect(e.starts_at).toBe("2027-01-30T01:00:00.000Z");
    expect(t(e.ends_at) - t(e.starts_at)).toBe(2 * DAY);
    expect(t(e.starts_at) - t(e.decision_deadline ?? "")).toBe(14 * DAY);
    expect(t(e.starts_at) - t(e.reg_closes_at ?? "")).toBe(30 * DAY);
    expect(e.questions.map((q) => [q.id, q.type, q.required])).toEqual([["skills", "short", true], ["experience", "select", true], ["github", "url", false]]);
    expect(e.questions[1]?.options).toHaveLength(3);

    const applied = regs("devhack-2027", "applied");
    expect(applied).toHaveLength(64);
    expect(applied.filter((r) => r.team_id === null)).toHaveLength(6);
    for (const r of applied) {
      expect(answersValid(e.questions, r.answers)).toBe(true);
      expect(r.decided_at).toBeNull();
    }
    const decided = regs("devhack-2027").filter((r) => r.status !== "applied");
    expect(decided.map((r) => r.status).sort()).toEqual(["going", "going", "rejected"]);
    for (const r of decided) {
      expect(r.decided_at).not.toBeNull();
      expect(r.decided_by).not.toBeNull();
      expect(r.decision_notified_at).toBeNull();
    }
  });
  it("devhack-2027 teams: ~14-16 teams of 2-4, captain is a member, unique codes, some looking_for", () => {
    const e = ev("devhack-2027");
    const teams = db.teams.filter((x) => x.event_id === e.id);
    expect(teams.length).toBeGreaterThanOrEqual(12);
    expect(teams.length).toBeLessThanOrEqual(18);
    for (const tm of teams) {
      const members = db.registrations.filter((r) => r.team_id === tm.id);
      expect(members.length).toBeGreaterThanOrEqual(2);
      expect(members.length).toBeLessThanOrEqual(4);
      expect(members.some((r) => r.profile_id === tm.captain_profile_id)).toBe(true);
      expect(tm.invite_code).toMatch(/^HK-[A-Z0-9]{4}$/);
    }
    expect(teams.some((x) => x.looking_for.length > 0)).toBe(true);
    expect(dups(db.teams.map((x) => x.invite_code))).toBe(0);
  });
  it("members-meetup-live: happening now with 31 going", () => {
    const e = ev("members-meetup-live");
    expect(e).toMatchObject({ status: "published", reg_mode: "rsvp", capacity: 40 });
    expect(t(e.starts_at)).toBe(NOW.getTime() - HOUR);
    expect(t(e.ends_at)).toBe(NOW.getTime() + 2 * HOUR);
    expect(regs("members-meetup-live", "going")).toHaveLength(31);
  });
  it("online-workshop-git: online, members audience, in 6 days", () => {
    const e = ev("online-workshop-git");
    expect(e).toMatchObject({ kind: "workshop", mode: "online", online_url: "https://meet.example.com/hackum-git", status: "published", audience: "members", reg_mode: "rsvp" });
    expect(t(e.starts_at)).toBeGreaterThan(NOW.getTime() + 5 * DAY);
    expect(t(e.starts_at)).toBeLessThan(NOW.getTime() + 7 * DAY);
    for (const r of regs("online-workshop-git")) expect(prof2(r.profile_id).status).not.toBe("guest");
  });
  it("every event except c-battle-winter has cover and poster files that exist under /public", () => {
    for (const e of db.events) {
      if (e.slug === "c-battle-winter") continue;
      for (const p of [e.cover_path, e.poster_path]) {
        expect(p).toMatch(/^\/img\/(posters|club)\/[\w-]+\.jpg$/);
        expect(existsSync(path.join(process.cwd(), "public", p ?? "missing"))).toBe(true);
      }
    }
  });
});

function prof2(id: string): Profile {
  const p = db.profiles.find((x) => x.id === id);
  if (!p) throw new Error(`missing profile ${id}`);
  return p;
}

describe("registrations", () => {
  it("are unique per (event, profile) and never exceed capacity", () => {
    expect(dups(db.registrations.map((r) => `${r.event_id}:${r.profile_id}`))).toBe(0);
    for (const e of db.events.filter((x) => x.capacity !== null)) {
      const seats = db.registrations.filter((r) => r.event_id === e.id && (r.status === "going" || r.status === "attended")).length;
      expect(seats).toBeLessThanOrEqual(e.capacity ?? 0);
    }
  });
  it("only claimed, onboarded profiles register; answers match each event's questions; created within the last 30 days", () => {
    for (const r of db.registrations) {
      const p = prof2(r.profile_id);
      expect(p.clerk_user_id).not.toBeNull();
      expect(p.onboarded_at).not.toBeNull();
      const e = db.events.find((x) => x.id === r.event_id);
      expect(answersValid(e?.questions ?? [], r.answers)).toBe(true);
      expect(t(r.created_at)).toBeLessThanOrEqual(NOW.getTime());
      expect(t(r.created_at)).toBeGreaterThanOrEqual(NOW.getTime() - 60 * DAY);
      if (e?.audience === "members") expect(p.status).not.toBe("guest");
    }
  });
});

describe("referential integrity", () => {
  it("every foreign key resolves", () => {
    const profiles = new Set(db.profiles.map((p) => p.id));
    const events = new Set(db.events.map((e) => e.id));
    const teams = new Map(db.teams.map((x) => [x.id, x]));
    for (const r of db.registrations) {
      expect(events.has(r.event_id)).toBe(true);
      expect(profiles.has(r.profile_id)).toBe(true);
      if (r.team_id) expect(teams.get(r.team_id)?.event_id).toBe(r.event_id);
      if (r.decided_by) expect(profiles.has(r.decided_by)).toBe(true);
    }
    for (const x of db.teams) {
      expect(events.has(x.event_id)).toBe(true);
      expect(profiles.has(x.captain_profile_id)).toBe(true);
    }
    for (const m of db.memberships) expect(profiles.has(m.profile_id)).toBe(true);
    for (const s of db.staff_roles) {
      expect(profiles.has(s.profile_id)).toBe(true);
      if (s.granted_by) expect(profiles.has(s.granted_by)).toBe(true);
    }
    for (const a of db.membership_applications) {
      expect(profiles.has(a.profile_id)).toBe(true);
      if (a.reviewed_by) expect(profiles.has(a.reviewed_by)).toBe(true);
    }
    for (const n of db.notifications) if (n.profile_id) expect(profiles.has(n.profile_id)).toBe(true);
    for (const e of db.events) if (e.created_by) expect(profiles.has(e.created_by)).toBe(true);
    const staff = new Set(db.staff_roles.map((s) => s.profile_id));
    for (const a of db.audit_log) if (a.actor_profile_id) expect(staff.has(a.actor_profile_id)).toBe(true);
  });
  it("ids carry stable prefixes, are globally unique, and seq exceeds every one", () => {
    const rows: [string, { id: string }[]][] = [
      ["p", db.profiles], ["e", db.events], ["r", db.registrations], ["t", db.teams], ["a", db.membership_applications],
      ["n", db.notifications], ["m", db.timeline_milestones], ["au", db.audit_log],
    ];
    const all: string[] = [];
    for (const [prefix, list] of rows) {
      for (const row of list) {
        expect(row.id).toMatch(new RegExp(`^${prefix}_\\d+$`));
        all.push(row.id);
      }
    }
    expect(dups(all.map((id) => String(idNum(id))))).toBe(0);
    expect(db.seq).toBeGreaterThan(Math.max(...all.map(idNum)));
  });
});

describe("membership applications", () => {
  it("7 pending (guests, Mongolian motivation), 3 approved by dev-organizer, 1 rejected, all for 2027", () => {
    const apps = db.membership_applications;
    const of = (s: string) => apps.filter((a) => a.status === s);
    expect(of("pending")).toHaveLength(7);
    expect(of("approved")).toHaveLength(3);
    expect(of("rejected")).toHaveLength(1);
    expect(apps).toHaveLength(11);
    expect(dups(apps.map((a) => `${a.profile_id}:${a.season}`))).toBe(0);
    const organizer = prof("dev-organizer").id;
    for (const a of apps) {
      expect(a.season).toBe(2027);
      expect(a.motivation).toMatch(/[А-Яа-яӨөҮү]/);
      expect(a.team_interest.length).toBeGreaterThan(0);
      for (const ti of a.team_interest) expect(TEAMS).toContain(ti);
    }
    for (const a of of("pending")) {
      expect(prof2(a.profile_id).status).toBe("guest");
      expect(a.reviewed_by).toBeNull();
    }
    for (const a of [...of("approved"), ...of("rejected")]) {
      expect(a.reviewed_by).toBe(organizer);
      expect(a.reviewed_at).not.toBeNull();
      expect(a.review_note).toBeTruthy();
    }
    for (const a of of("approved")) {
      expect(prof2(a.profile_id).status).toBe("member");
      expect(db.memberships.some((m) => m.profile_id === a.profile_id && m.season === 2027)).toBe(true);
    }
    expect(prof("temuulen").id).not.toBe(apps.find((a) => a.profile_id === prof("temuulen").id)?.profile_id);
  });
});

describe("notifications and email", () => {
  it("about 40 rows with the intended status mix", () => {
    const n = db.notifications;
    expect(n).toHaveLength(40);
    const count = (s: string) => n.filter((x) => x.status === s).length;
    expect(count("failed")).toBe(3);
    expect(count("queued")).toBe(4);
    expect(count("skipped")).toBe(2);
    expect(count("sent")).toBe(31);
  });
  it("exactly one of profile_id / to_email; known templates; unique dedupe keys", () => {
    for (const x of db.notifications) {
      expect(Number(x.profile_id !== null) + Number(x.to_email !== null)).toBe(1);
      expect(TEMPLATES).toContain(x.template);
      expect(x.channel).toBe("email");
      expect([0, 1, 2]).toContain(x.priority);
      if (x.to_email) expect(x.to_email).toMatch(/@example\.(com|org|edu\.mn)$/);
    }
    expect(dups(db.notifications.map((x) => x.dedupe_key))).toBe(0);
  });
  it("sent rows have sent_at; failed rows exhausted retries; queued rows are future reminders", () => {
    for (const x of db.notifications) {
      if (x.status === "sent") {
        expect(x.sent_at).not.toBeNull();
        expect(t(x.sent_at ?? "")).toBeLessThanOrEqual(NOW.getTime());
      }
      if (x.status === "failed") {
        expect(x.attempts).toBe(5);
        expect(x.last_error).toBeTruthy();
        expect(x.sent_at).toBeNull();
      }
      if (x.status === "queued") {
        expect(x.template).toBe("reminder_24h");
        expect(t(x.scheduled_at)).toBeGreaterThan(NOW.getTime());
        expect(x.sent_at).toBeNull();
      }
    }
    expect(db.notifications.some((x) => x.last_error === "mailbox_unavailable")).toBe(true);
  });
  it("daily usage has today's UB key at 37 and smaller previous days; 1-2 suppressions", () => {
    const keys = Object.keys(db.email_daily_usage).sort();
    expect(keys.at(-1)).toBe("2026-11-16");
    expect(db.email_daily_usage["2026-11-16"]).toBe(37);
    expect(keys.length).toBeGreaterThanOrEqual(3);
    for (const k of keys.slice(0, -1)) expect(db.email_daily_usage[k]).toBeLessThan(37);
    expect(db.email_suppressions.length).toBeGreaterThanOrEqual(1);
    expect(db.email_suppressions.length).toBeLessThanOrEqual(2);
  });
});

describe("content tables", () => {
  it("subscribers ~25 with unique example.* emails", () => {
    expect(db.subscribers).toHaveLength(25);
    expect(dups(db.subscribers.map((s) => s.email))).toBe(0);
    for (const s of db.subscribers) expect(s.email).toMatch(/@example\.(com|org|edu\.mn)$/);
  });
  it("16 timeline milestones for 2017-2026, ascending, bilingual", () => {
    const m = db.timeline_milestones;
    expect(m).toHaveLength(16);
    expect(m.map((x) => x.sort)).toEqual([...m.map((x) => x.sort)].sort((a, b) => a - b));
    expect(m.map((x) => x.year)).toEqual([...m.map((x) => x.year)].sort((a, b) => a - b));
    expect(Math.min(...m.map((x) => x.year))).toBe(2017);
    expect(Math.max(...m.map((x) => x.year))).toBe(2026);
    for (const x of m) {
      expect(x.title.mn).toBeTruthy();
      expect(x.title.en).toBeTruthy();
    }
  });
  it("audit log has ~25 staff-authored entries with small diffs", () => {
    const a = db.audit_log;
    expect(a.length).toBeGreaterThanOrEqual(24);
    expect(a.length).toBeLessThanOrEqual(30);
    for (const e of a) {
      expect(e.action).toMatch(/^[a-z_]+\.[a-z_]+$/);
      expect(Object.keys(e.diff).length).toBeLessThanOrEqual(4);
      expect(t(e.at)).toBeLessThanOrEqual(NOW.getTime());
    }
    const actions = new Set(a.map((e) => e.action));
    for (const x of ["event.update", "registration.decide", "membership.approve"]) expect(actions.has(x)).toBe(true);
  });
});

describe("no real personal data", () => {
  it("every email anywhere is on a reserved example domain", () => {
    const emails = [
      ...db.profiles.flatMap((p) => (p.email ? [p.email] : [])),
      ...db.subscribers.map((s) => s.email),
      ...db.email_suppressions.map((s) => s.email),
      ...db.notifications.flatMap((n) => (n.to_email ? [n.to_email] : [])),
    ];
    expect(emails.length).toBeGreaterThan(100);
    for (const e of emails) expect(e).toMatch(/@example\.(com|org|edu\.mn)$/);
    const blob = JSON.stringify(db);
    const found = blob.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
    for (const e of found) expect(e).toMatch(/@example\.(com|org|edu\.mn)$/);
  });
});

describe("recent past events with attendance (so badges, past tabs and returning-vs-new have data)", () => {
  const recent = ["react-workshop-autumn", "cv-workshop-autumn", "css-battle-autumn", "git-night-autumn", "pitch-night-autumn"];
  it("has five completed events in the last 50 days, each with attendance", () => {
    for (const slug of recent) {
      const e = ev(slug);
      expect(e.status).toBe("completed");
      expect(Date.parse(e.ends_at)).toBeLessThan(NOW.getTime());
      expect(Date.parse(e.starts_at)).toBeGreaterThan(NOW.getTime() - 50 * DAY);
      expect(regs(slug, "attended").length).toBeGreaterThanOrEqual(12);
      expect(e.cover_path && existsSync(path.join(process.cwd(), "public", e.cover_path))).toBeTruthy();
    }
  });
  it("lets the member persona earn the 'regular' badge and the alumna a few attendances", () => {
    const attended = (handle: string) => db.registrations.filter((r) => r.profile_id === prof(handle).id && r.status === "attended" && recent.includes(db.events.find((e) => e.id === r.event_id)!.slug)).length;
    expect(attended("anuujin")).toBe(5);
    expect(attended("saraa")).toBeGreaterThanOrEqual(3);
    expect(attended("dev-admin")).toBe(0);
    expect(attended("new-guest")).toBe(0);
    expect(attended("temuulen")).toBe(0); // the guest persona has no past events (empty "Past" tab, locked badges)
  });
  it("keeps ids unique after the extra rows", () => {
    const ids = [...db.events.map((e) => e.id), ...db.registrations.map((r) => r.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const numeric = ids.map((id) => Number(id.split("_")[1]));
    expect(db.seq).toBeGreaterThan(Math.max(...numeric));
  });
});
