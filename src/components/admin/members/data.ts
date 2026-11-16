import "server-only";
// Read-side selectors for the Members area: plain serialisable DTOs built from the mock db (never the raw rows, so a
// column added to `profiles` later can't leak into the client by accident). Swap the source, keep the DTO shapes.
import type { L } from "@/i18n/config";
import { suggestDuplicates, type DuplicatePair } from "@/lib/members/duplicates";
import { seasonWindow } from "@/lib/members/format";
import { profileOf } from "@/lib/mockdb/core";
import { getStore } from "@/lib/mockdb/store";
import type { ApplicationStatus, MemberStatus, RegStatus } from "@/lib/status";

export type MemberDto = {
  id: string; handle: string; name: L; status: MemberStatus; school: string | null; major: string | null; gradYear: number | null;
  locale: "mn" | "en"; email: string | null; claimed: boolean; createdAt: string; lastSeenAt: string | null; links: Record<string, string>;
  seasons: number[]; team: string | null; attended: number; going: number;
  memberships: { season: number; team: string | null; role: L | null }[];
  registrations: { id: string; event: L; startsAt: string; status: RegStatus }[];
  applications: { id: string; season: number; status: ApplicationStatus; createdAt: string }[];
};

export type DirectoryData = { members: MemberDto[]; seasons: { year: number; count: number }[]; teams: string[]; now: string };

export function loadDirectory(): DirectoryData {
  const store = getStore();
  const db = store.read();
  const now = store.now();
  const current = db.seasons.find((s) => s.is_current)?.year;
  const members: MemberDto[] = db.profiles.filter((p) => !p.deleted_at).map((p) => {
    const ms = db.memberships.filter((m) => m.profile_id === p.id).sort((a, b) => b.season - a.season);
    const regs = db.registrations.filter((r) => r.profile_id === p.id);
    return {
      id: p.id, handle: p.handle, name: p.name, status: p.status, school: p.school, major: p.major, gradYear: p.grad_year, locale: p.locale,
      email: p.email, claimed: !!p.clerk_user_id, createdAt: p.created_at, lastSeenAt: p.last_seen_at, links: p.links,
      seasons: ms.map((m) => m.season).sort((a, b) => a - b),
      team: ms.find((m) => m.season === current)?.team ?? ms[0]?.team ?? null,
      attended: regs.filter((r) => r.status === "attended").length,
      going: regs.filter((r) => r.status === "going").length,
      memberships: ms.map((m) => ({ season: m.season, team: m.team, role: m.role_title })),
      registrations: regs.flatMap((r) => {
        const ev = db.events.find((e) => e.id === r.event_id);
        return ev ? [{ id: r.id, event: ev.title, startsAt: ev.starts_at, status: r.status }] : [];
      }).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
      applications: db.membership_applications.filter((a) => a.profile_id === p.id).map((a) => ({ id: a.id, season: a.season, status: a.status, createdAt: a.created_at })),
    };
  });
  const seasons = [...new Set(db.memberships.map((m) => m.season))].sort((a, b) => b - a)
    .map((year) => ({ year, count: new Set(db.memberships.filter((m) => m.season === year).map((m) => m.profile_id)).size }));
  const teams = [...new Set(db.memberships.map((m) => m.team).filter((t): t is string => !!t))].sort();
  return { members, seasons, teams, now: now.toISOString() };
}

export type ApplicationDto = {
  id: string; status: ApplicationStatus; season: number; seasonLabel: L; motivation: string; interests: string[]; createdAt: string;
  reviewedAt: string | null; reviewer: string | null; note: string | null;
  person: { id: string; name: L; handle: string; school: string | null; gradYear: number | null; attended: number };
};
export type ApplicationsData = {
  items: ApplicationDto[]; now: string;
  window: { kind: "open" | "scheduled" | "none"; label: L | null; at: string | null };
};

export function loadApplications(): ApplicationsData {
  const store = getStore();
  const db = store.read();
  const now = store.now();
  const items = db.membership_applications.flatMap((a): ApplicationDto[] => {
    const p = profileOf(db, a.profile_id);
    if (!p || a.status === "withdrawn") return [];
    const reviewer = profileOf(db, a.reviewed_by);
    return [{
      id: a.id, status: a.status, season: a.season, seasonLabel: db.seasons.find((s) => s.year === a.season)?.label ?? { mn: String(a.season), en: String(a.season) },
      motivation: a.motivation, interests: a.team_interest, createdAt: a.created_at, reviewedAt: a.reviewed_at,
      reviewer: reviewer ? reviewer.name.mn || reviewer.name.en || reviewer.handle : null, note: a.review_note,
      person: { id: p.id, name: p.name, handle: p.handle, school: p.school, gradYear: p.grad_year, attended: db.registrations.filter((r) => r.profile_id === p.id && r.status === "attended").length },
    }];
  });
  // The queue is first come, first served; reviewed items show the latest decision first.
  items.sort((a, b) => (a.status === "pending" && b.status === "pending" ? a.createdAt.localeCompare(b.createdAt) : (b.reviewedAt ?? b.createdAt).localeCompare(a.reviewedAt ?? a.createdAt)));
  const open = db.seasons.find((s) => seasonWindow(s, now) === "open");
  const next = db.seasons.filter((s) => seasonWindow(s, now) === "scheduled").sort((a, b) => (a.application_opens_at ?? "").localeCompare(b.application_opens_at ?? ""))[0];
  const window: ApplicationsData["window"] = open ? { kind: "open", label: open.label, at: open.application_closes_at } : next ? { kind: "scheduled", label: next.label, at: next.application_opens_at } : { kind: "none", label: null, at: null };
  return { items, window, now: now.toISOString() };
}

export const pendingApplicationCount = () => getStore().read().membership_applications.filter((a) => a.status === "pending").length;

export type MergeProfileDto = {
  id: string; name: L; handle: string; status: MemberStatus; school: string | null; claimed: boolean; lastSeenAt: string | null;
  regEvents: string[]; seasons: number[]; appSeasons: number[];
};
export type MergeData = { profiles: MergeProfileDto[]; suggestions: DuplicatePair[]; now: string };

export function loadMerge(): MergeData {
  const store = getStore();
  const db = store.read();
  const live = db.profiles.filter((p) => !p.deleted_at);
  const profiles: MergeProfileDto[] = live.map((p) => ({
    id: p.id, name: p.name, handle: p.handle, status: p.status, school: p.school, claimed: !!p.clerk_user_id, lastSeenAt: p.last_seen_at,
    regEvents: db.registrations.filter((r) => r.profile_id === p.id).map((r) => r.event_id),
    seasons: db.memberships.filter((m) => m.profile_id === p.id).map((m) => m.season),
    appSeasons: db.membership_applications.filter((a) => a.profile_id === p.id).map((a) => a.season),
  })).sort((a, b) => (a.name.mn || a.name.en || a.handle).localeCompare(b.name.mn || b.name.en || b.handle, "mn"));
  // Email is used for matching on the server only; it never travels to the browser.
  const suggestions = suggestDuplicates(live.map((p) => ({ id: p.id, name: p.name, email: p.email })));
  return { profiles, suggestions, now: store.now().toISOString() };
}
