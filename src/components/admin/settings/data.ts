import "server-only";
import type { L } from "@/i18n/config";
import { seasonWindow, type SeasonWindow } from "@/lib/members/format";
import { profileOf } from "@/lib/mockdb/core";
import { getStore } from "@/lib/mockdb/store";
import type { StaffRoleName } from "@/lib/mockdb/types";
import type { PersonLite } from "@/components/admin/members/shared";

export type SeasonDto = { year: number; label: L; opensAt: string | null; closesAt: string | null; isCurrent: boolean; window: SeasonWindow };
export type SeasonsData = { seasons: SeasonDto[]; now: string };

export function loadSeasons(): SeasonsData {
  const store = getStore();
  const now = store.now();
  const seasons = store.read().seasons.map((s): SeasonDto => ({ year: s.year, label: s.label, opensAt: s.application_opens_at, closesAt: s.application_closes_at, isCurrent: s.is_current, window: seasonWindow(s, now) }))
    .sort((a, b) => b.year - a.year);
  return { seasons, now: now.toISOString() };
}

export type StaffDto = { id: string; name: L; handle: string; role: StaffRoleName; grantedAt: string; grantedBy: string | null; isYou: boolean };
export type StaffData = { staff: StaffDto[]; candidates: PersonLite[]; adminCount: number; now: string };

export function loadStaff(actorId: string): StaffData {
  const store = getStore();
  const db = store.read();
  const staff = db.staff_roles.flatMap((r): StaffDto[] => {
    const p = profileOf(db, r.profile_id);
    if (!p) return [];
    const by = profileOf(db, r.granted_by);
    return [{ id: p.id, name: p.name, handle: p.handle, role: r.role, grantedAt: r.granted_at, grantedBy: by ? by.name.mn || by.name.en || by.handle : null, isYou: p.id === actorId }];
  }).sort((a, b) => (a.role === b.role ? a.name.mn.localeCompare(b.name.mn, "mn") : a.role === "admin" ? -1 : 1));
  const staffIds = new Set(db.staff_roles.map((r) => r.profile_id));
  const candidates = db.profiles.filter((p) => !p.deleted_at && !staffIds.has(p.id) && p.onboarded_at)
    .map((p): PersonLite => ({ id: p.id, name: p.name, handle: p.handle, status: p.status, school: p.school }))
    .sort((a, b) => (a.name.mn || a.handle).localeCompare(b.name.mn || b.handle, "mn"));
  return { staff, candidates, adminCount: db.staff_roles.filter((r) => r.role === "admin").length, now: store.now().toISOString() };
}
