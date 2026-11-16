// Read side of the member app (/me): pure view-model builders over a Db. They return plain, serialisable data that is
// safe to hand to client components: no staff notes, no other people's private fields, no online links the viewer has
// not earned (eventForViewer). Nothing here writes; every change goes through src/lib/me/actions.ts → mockdb rules.
import type { L, Locale } from "@/i18n/config";
import { goingCount } from "@/lib/mockdb/core";
import { openSeason } from "@/lib/mockdb/members";
import { eventForViewer, myEvents } from "@/lib/mockdb/queries";
import type { Db, EventRow, Profile, Registration, Season } from "@/lib/mockdb/types";
import type { ApplicationStatus, MemberStatus, RegStatus } from "@/lib/status";
import { computeBadges, type Badge } from "./badges";

const HOUR = 3_600_000;
const DAY = 86_400_000;
const UB_OFFSET = 8 * HOUR;
const RECENT_DAYS = 14;

/** Only same-site, locale-prefixed paths are followed after sign-in / onboarding (no open redirect). */
export function safeNextPath(next: unknown, lang: Locale): string {
  const fallback = `/${lang}/me`;
  if (typeof next !== "string") return fallback;
  if (!/^\/(mn|en)(\/[A-Za-z0-9\-._~%/]*)?(\?[A-Za-z0-9\-._~%=&]*)?$/.test(next)) return fallback;
  if (next.includes("//") || next.includes("..")) return fallback;
  return next;
}

/** "3rd" / "3-р". */
export function ordinal(lang: Locale, n: number): string {
  if (lang === "mn") return `${n}-р`;
  const rule = new Intl.PluralRules("en", { type: "ordinal" }).select(n);
  return `${n}${({ one: "st", two: "nd", few: "rd", other: "th", zero: "th", many: "th" } as const)[rule]}`;
}

const ubDayIndex = (d: Date) => Math.floor((d.getTime() + UB_OFFSET) / DAY);

export type Countdown = { kind: "in" | "live" | "past"; text: string };
/** How far away an event is ("in 3 days", "tomorrow", "in 5 hours"), counted in Ulaanbaatar calendar days. */
export function countdown(ev: Pick<EventRow, "starts_at" | "ends_at">, now: Date, lang: Locale): Countdown {
  const start = new Date(ev.starts_at);
  if (new Date(ev.ends_at) <= now) return { kind: "past", text: "" };
  if (start <= now) return { kind: "live", text: "" };
  const rtf = new Intl.RelativeTimeFormat(lang === "mn" ? "mn" : "en", { numeric: "auto" });
  const diff = start.getTime() - now.getTime();
  if (diff < DAY && ubDayIndex(start) === ubDayIndex(now)) {
    return diff >= HOUR
      ? { kind: "in", text: rtf.format(Math.floor(diff / HOUR), "hour") }
      : { kind: "in", text: rtf.format(Math.max(1, Math.ceil(diff / 60_000)), "minute") };
  }
  return { kind: "in", text: rtf.format(ubDayIndex(start) - ubDayIndex(now), "day") };
}

// ── eligibility ──────────────────────────────────────────────────────────────────────────────────────────────────

export type Reason = "members" | "alumni" | "invite" | "school" | "closed" | "not_open" | "full" | "cancelled";
export type Eligibility = { ok: true; waitlist: boolean } | { ok: false; reason: Reason; at?: string };

/** Can this person register right now, and if not, why? Mirrors the checks in registerForEvent so the UI never offers a dead end. */
export function eligibility(db: Db, ev: EventRow, me: Profile, now: Date): Eligibility {
  if (ev.status === "cancelled") return { ok: false, reason: "cancelled" };
  if (ev.status !== "published") return { ok: false, reason: "closed" };
  if (ev.audience === "invite") return { ok: false, reason: "invite" };
  if (ev.school_scope === "num" && me.school_id !== "num") return { ok: false, reason: "school" };
  if (ev.audience === "members" && me.status !== "member") return { ok: false, reason: "members" };
  if (ev.audience === "alumni" && me.status !== "alumni") return { ok: false, reason: "alumni" };
  if (ev.reg_opens_at && now < new Date(ev.reg_opens_at)) return { ok: false, reason: "not_open", at: ev.reg_opens_at };
  if ((ev.reg_closes_at && now > new Date(ev.reg_closes_at)) || now > new Date(ev.ends_at)) return { ok: false, reason: "closed" };
  if (ev.reg_mode === "rsvp" && ev.capacity !== null && goingCount(db, ev.id) >= ev.capacity) {
    return ev.waitlist ? { ok: true, waitlist: true } : { ok: false, reason: "full" };
  }
  return { ok: true, waitlist: false };
}

/**
 * The status the applicant is allowed to see. Acceptance shows at once (it is good news and the seat is theirs);
 * a rejection stays "applied" until staff press "send decisions", so nobody reads bad news before the email.
 */
export function visibleStatus(reg: Pick<Registration, "status" | "decision_notified_at">, ev: Pick<EventRow, "reg_mode">): RegStatus {
  return ev.reg_mode === "application" && reg.status === "rejected" && !reg.decision_notified_at ? "applied" : reg.status;
}

/** 1-based place in the waitlist, by arrival; null when not waitlisted. */
export function waitlistPosition(db: Db, reg: Registration): number | null {
  if (reg.status !== "waitlisted") return null;
  const line = db.registrations.filter((r) => r.event_id === reg.event_id && r.status === "waitlisted").sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const i = line.findIndex((r) => r.id === reg.id);
  return i < 0 ? null : i + 1;
}

// ── event cards ──────────────────────────────────────────────────────────────────────────────────────────────────

export type EventCardVm = {
  id: string; slug: string; kind: EventRow["kind"]; title: L; tagline: L;
  starts_at: string; ends_at: string; approximate: boolean; cover: string | null;
  mode: EventRow["mode"]; venue: string | null; onlineUrl: string | null;
  regMode: EventRow["reg_mode"]; audience: EventRow["audience"]; schoolScope: EventRow["school_scope"]; cancelled: boolean;
  capacity: number | null; going: number; seatsLeft: number | null;
  decisionDeadline: string | null; teamMode: EventRow["team_mode"];
  live: boolean; over: boolean;
  reg: { status: RegStatus; teamId: string | null; waitPos: number | null } | null;
  elig: Eligibility;
};

export function cardVm(db: Db, ev: EventRow, me: Profile, now: Date): EventCardVm {
  const reg = db.registrations.find((r) => r.event_id === ev.id && r.profile_id === me.id && r.status !== "cancelled") ?? null;
  const going = goingCount(db, ev.id);
  return {
    id: ev.id, slug: ev.slug, kind: ev.kind, title: ev.title, tagline: ev.tagline, starts_at: ev.starts_at, ends_at: ev.ends_at,
    approximate: ev.approximate_date, cover: ev.cover_path, mode: ev.mode, venue: ev.venue_name,
    onlineUrl: eventForViewer(db, ev.slug, me.id)?.online_url ?? null, // null unless the viewer holds a seat
    regMode: ev.reg_mode, audience: ev.audience, schoolScope: ev.school_scope, cancelled: ev.status === "cancelled",
    capacity: ev.capacity, going, seatsLeft: ev.capacity === null ? null : Math.max(0, ev.capacity - going),
    decisionDeadline: ev.decision_deadline, teamMode: ev.team_mode,
    live: new Date(ev.starts_at) <= now && new Date(ev.ends_at) > now, over: new Date(ev.ends_at) <= now,
    reg: reg ? { status: visibleStatus(reg, ev), teamId: reg.team_id, waitPos: waitlistPosition(db, reg) } : null,
    elig: eligibility(db, ev, me, now),
  };
}

const meOf = (db: Db, profileId: string): Profile => {
  const p = db.profiles.find((x) => x.id === profileId && !x.deleted_at);
  if (!p) throw new Error("me: unknown profile");
  return p;
};

/** The four tabs of /me/events. Counts are the list lengths, so a tab and its badge can never disagree. */
export function eventsTabs(db: Db, profileId: string, now: Date) {
  const me = meOf(db, profileId);
  const mine = myEvents(db, profileId, now);
  const card = (e: EventRow) => cardVm(db, e, me, now);
  return {
    upcoming: mine.upcoming.map(card),
    going: mine.going.map((x) => card(x.event)),
    applied: mine.applied.map((x) => card(x.event)),
    past: mine.past.map((x) => card(x.event)),
  };
}

// ── needs your attention ─────────────────────────────────────────────────────────────────────────────────────────

export type Attention =
  | { kind: "decision"; slug: string; title: L; result: "going" | "rejected" | "waitlisted"; teamId: string | null }
  | { kind: "waitlist"; slug: string; title: L; position: number }
  | { kind: "membership"; result: "approved" | "rejected"; season: number }
  | { kind: "team"; teamId: string; teamName: string; slug: string; title: L; have: number; need: number; code: string };

export function attentionFor(db: Db, profileId: string, now: Date): Attention[] {
  const recent = (iso: string | null) => !!iso && now.getTime() - new Date(iso).getTime() < RECENT_DAYS * DAY;
  const regs = db.registrations.filter((r) => r.profile_id === profileId);
  const live = (e: EventRow) => new Date(e.ends_at) > now;
  const out: Attention[] = [];
  const decisions: Attention[] = [], waits: Attention[] = [], teams: Attention[] = [];

  for (const r of regs) {
    const ev = db.events.find((e) => e.id === r.event_id);
    if (!ev || !live(ev) || ev.status === "cancelled") continue;
    const seen = visibleStatus(r, ev);
    if (ev.reg_mode === "application" && r.decided_at && recent(r.decided_at) && (seen === "going" || seen === "rejected" || seen === "waitlisted")) {
      decisions.push({ kind: "decision", slug: ev.slug, title: ev.title, result: seen, teamId: r.team_id });
    } else if (r.status === "waitlisted") {
      const position = waitlistPosition(db, r);
      if (position) waits.push({ kind: "waitlist", slug: ev.slug, title: ev.title, position });
    }
    const team = r.team_id && r.status !== "cancelled" ? db.teams.find((t) => t.id === r.team_id) : undefined;
    if (team) {
      const have = db.registrations.filter((o) => o.team_id === team.id && o.status !== "cancelled").length;
      if (have < ev.team_size_min) teams.push({ kind: "team", teamId: team.id, teamName: team.name, slug: ev.slug, title: ev.title, have, need: ev.team_size_min, code: team.invite_code });
    }
  }
  const memberships: Attention[] = db.membership_applications
    .filter((a) => a.profile_id === profileId && (a.status === "approved" || a.status === "rejected") && recent(a.reviewed_at))
    .map((a) => ({ kind: "membership" as const, result: a.status as "approved" | "rejected", season: a.season }));
  out.push(...decisions, ...waits, ...memberships, ...teams);
  return out;
}

// ── membership ───────────────────────────────────────────────────────────────────────────────────────────────────

export type MembershipView = {
  status: MemberStatus;
  window: { state: "open"; season: number; label: L; until: string } | { state: "opens"; season: number; label: L; from: string } | { state: "closed" };
  /** Never carries the staff review note. */
  app: { status: ApplicationStatus; season: number; created_at: string; reviewed_at: string | null } | null;
  /** Membership is for NUM students who picked a major; anyone else stays a guest and is told why. */
  eligibility: "ok" | "school" | "major";
  canApply: boolean;
  /** A member while an application window is open and they have not renewed (or asked to) for it. */
  renew: { season: number; label: L; until: string } | null;
  renewPending: boolean;
  history: { season: number; label: L; team: string | null; role: L | null }[];
};

export function membershipView(db: Db, profileId: string, now: Date): MembershipView {
  const me = meOf(db, profileId);
  const open = openSeason({ db, actor: profileId, now });
  const later = db.seasons
    .filter((s): s is Season & { application_opens_at: string } => !!s.application_opens_at && new Date(s.application_opens_at) > now)
    .sort((a, b) => a.application_opens_at.localeCompare(b.application_opens_at))[0];
  const window: MembershipView["window"] = open
    ? { state: "open", season: open.year, label: open.label, until: open.application_closes_at ?? "" }
    : later ? { state: "opens", season: later.year, label: later.label, from: later.application_opens_at } : { state: "closed" };
  const eligible: MembershipView["eligibility"] = me.school_id !== "num" ? "school" : !me.major_track ? "major" : "ok";
  const mine = db.membership_applications.filter((a) => a.profile_id === profileId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const row = (open ? mine.find((a) => a.season === open.year) : undefined) ?? mine[0];
  const hasSeason = (y: number) => db.memberships.some((m) => m.profile_id === profileId && m.season === y);
  const pendingFor = (y: number) => mine.some((a) => a.season === y && a.status === "pending");
  const label = (y: number): L => db.seasons.find((s) => s.year === y)?.label ?? { mn: String(y), en: String(y) };
  return {
    status: me.status,
    window,
    app: row ? { status: row.status, season: row.season, created_at: row.created_at, reviewed_at: row.reviewed_at } : null,
    eligibility: eligible,
    canApply: eligible === "ok" && me.status !== "member" && me.status !== "alumni" && !!open && !mine.some((a) => a.season === open.year),
    renew: me.status === "member" && eligible !== "school" && !!open && !hasSeason(open.year) && !pendingFor(open.year)
      ? { season: open.year, label: open.label, until: open.application_closes_at ?? "" } : null,
    renewPending: me.status === "member" && !!open && !hasSeason(open.year) && pendingFor(open.year),
    history: db.memberships.filter((m) => m.profile_id === profileId).sort((a, b) => b.season - a.season).map((m) => ({ season: m.season, label: label(m.season), team: m.team, role: m.role_title })),
  };
}

// ── team ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type TeamView = {
  id: string; name: string; code: string; slug: string; eventTitle: L; eventId: string; eventOver: boolean;
  min: number; max: number; locked: boolean; lookingFor: string[]; isCaptain: boolean;
  members: { profileId: string; name: L; avatar: string | null; captain: boolean; you: boolean }[];
};

/** A team is visible only to the people in it (null → 404). */
export function teamView(db: Db, teamId: string, viewerId: string, now: Date = new Date()): TeamView | null {
  const team = db.teams.find((t) => t.id === teamId);
  if (!team) return null;
  const regs = db.registrations.filter((r) => r.team_id === team.id && r.status !== "cancelled");
  if (!regs.some((r) => r.profile_id === viewerId)) return null;
  const ev = db.events.find((e) => e.id === team.event_id);
  if (!ev) return null;
  const members = regs.flatMap((r) => {
    const p = db.profiles.find((x) => x.id === r.profile_id && !x.deleted_at);
    return p ? [{ profileId: p.id, name: p.name, avatar: p.avatar_path, captain: p.id === team.captain_profile_id, you: p.id === viewerId, at: r.created_at }] : [];
  }).sort((a, b) => Number(b.captain) - Number(a.captain) || a.at.localeCompare(b.at)).map((m) => ({ profileId: m.profileId, name: m.name, avatar: m.avatar, captain: m.captain, you: m.you }));
  return {
    id: team.id, name: team.name, code: team.invite_code, slug: ev.slug, eventTitle: ev.title, eventId: ev.id, eventOver: new Date(ev.ends_at) <= now,
    min: ev.team_size_min, max: ev.team_size_max, locked: team.locked, lookingFor: team.looking_for, isCaptain: team.captain_profile_id === viewerId, members,
  };
}

// ── profile ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type ProfileVm = {
  id: string; handle: string; name: L; school: string | null; major: string | null; grad_year: number | null; status: MemberStatus;
  visibility: Profile["visibility"]; links: Record<string, string>; seasons: number[]; badges: Badge[];
  attended: { slug: string; title: L; starts_at: string; status: RegStatus }[];
};

export function profileView(db: Db, profileId: string, now: Date): ProfileVm {
  const p = meOf(db, profileId);
  const events = db.registrations
    .filter((r) => r.profile_id === profileId && (r.status === "attended" || r.status === "going"))
    .flatMap((r) => {
      const ev = db.events.find((e) => e.id === r.event_id);
      return ev && (r.status === "attended" || new Date(ev.ends_at) <= now) ? [{ slug: ev.slug, title: ev.title, starts_at: ev.starts_at, status: r.status }] : [];
    })
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  return {
    id: p.id, handle: p.handle, name: p.name, school: p.school, major: p.major, grad_year: p.grad_year, status: p.status, visibility: p.visibility, links: p.links,
    seasons: [...new Set(db.memberships.filter((m) => m.profile_id === profileId).map((m) => m.season))].sort((a, b) => b - a),
    badges: computeBadges(db, profileId, now), attended: events,
  };
}

// ── home ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function homeData(db: Db, profileId: string, now: Date) {
  const me = meOf(db, profileId);
  const mine = myEvents(db, profileId, now);
  const card = (e: EventRow) => cardVm(db, e, me, now);
  const started = (e: EventRow) => new Date(e.starts_at) <= now;
  const nextRow = mine.going.find((x) => x.registration.status === "going" && !started(x.event));
  const liveCards = [
    ...mine.going.filter((x) => x.registration.status === "going" && started(x.event)).map((x) => card(x.event)),
    ...mine.upcoming.filter((e) => started(e)).map(card).filter((c) => c.elig.ok),
  ];
  const brandNew = !db.registrations.some((r) => r.profile_id === profileId && r.status !== "cancelled")
    && !db.membership_applications.some((a) => a.profile_id === profileId);
  return {
    next: nextRow ? card(nextRow.event) : null,
    live: liveCards,
    attention: attentionFor(db, profileId, now),
    whatsNext: mine.upcoming.filter((e) => !started(e)).map(card).filter((c) => c.elig.ok).slice(0, 4),
    membership: membershipView(db, profileId, now),
    brandNew,
  };
}
