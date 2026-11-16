// What the registration panel on an event page should offer a given visitor. Pure: mirrors the guards in
// `registerForEvent` (src/lib/mockdb/registrations.ts) so the page never shows a button the rule would refuse.
import type { Db, EventRow } from "@/lib/mockdb/types";
import type { SchoolId } from "@/lib/num/schools";
import type { MemberStatus, RegStatus } from "@/lib/status";
import { waitlistPosition } from "./select";

/** `schoolId` undefined = unknown (treated as eligible); null = the profile has no school set yet. */
export type Viewer = { profileId: string; status: MemberStatus; onboarded: boolean; schoolId?: SchoolId | null } | null;

export type BlockReason = "not_open" | "closed" | "full" | "invite" | "members" | "alumni" | "school";
export type RsvpView =
  | { kind: "ended" }
  | { kind: "cancelled" }
  | { kind: "going" }
  | { kind: "attended" }
  | { kind: "waitlisted"; position: number }
  | { kind: "applied" }
  | { kind: "rejected" }
  | { kind: "signed_out"; apply: boolean }
  | { kind: "needs_onboarding" }
  | { kind: "rsvp"; waitlist: boolean }
  | { kind: "apply"; decisionDeadline: string | null }
  /** `numOnly`: a members-only event and the viewer studies elsewhere, so membership is not an option for them (F-12). */
  | { kind: "blocked"; reason: BlockReason; opensAt?: string; numOnly?: true };

const LIVE_STATUSES: RegStatus[] = ["going", "waitlisted", "applied", "attended", "rejected"];

export function rsvpView(db: Db, ev: EventRow, viewer: Viewer, now: Date): RsvpView {
  if (ev.status === "cancelled") return { kind: "cancelled" };
  const mine = viewer ? db.registrations.find((r) => r.event_id === ev.id && r.profile_id === viewer.profileId && LIVE_STATUSES.includes(r.status)) : undefined;

  if (mine?.status === "attended") return { kind: "attended" };
  const over = ev.status === "completed" || ev.status === "archived" || now > new Date(ev.ends_at);
  if (over) return { kind: "ended" };

  // A person's own registration wins over every restriction: they must always be able to see and cancel it.
  if (mine) {
    if (mine.status === "going") return { kind: "going" };
    if (mine.status === "waitlisted") return { kind: "waitlisted", position: waitlistPosition(db, ev.id, mine.profile_id) ?? 1 };
    if (mine.status === "applied") return { kind: "applied" };
    if (mine.status === "rejected") return { kind: "rejected" };
  }

  if (ev.audience === "invite") return { kind: "blocked", reason: "invite" };
  if (ev.reg_opens_at && now < new Date(ev.reg_opens_at)) return { kind: "blocked", reason: "not_open", opensAt: ev.reg_opens_at };
  if (ev.reg_closes_at && now > new Date(ev.reg_closes_at)) return { kind: "blocked", reason: "closed" };
  if (ev.status !== "published") return { kind: "blocked", reason: "closed" };

  const application = ev.reg_mode === "application";
  const full = !application && ev.capacity !== null && db.registrations.filter((r) => r.event_id === ev.id && (r.status === "going" || r.status === "attended")).length >= ev.capacity;
  if (full && !ev.waitlist) return { kind: "blocked", reason: "full" }; // no point asking anyone to sign in for a seat that does not exist
  if (!viewer) return { kind: "signed_out", apply: application };
  if (!viewer.onboarded) return { kind: "needs_onboarding" };
  const notNum = viewer.schoolId !== undefined && viewer.schoolId !== "num";
  if (ev.school_scope === "num" && notNum) return { kind: "blocked", reason: "school" };
  if (ev.audience === "members" && viewer.status !== "member") return { kind: "blocked", reason: "members", ...(notNum ? { numOnly: true as const } : {}) };
  if (ev.audience === "alumni" && viewer.status !== "alumni") return { kind: "blocked", reason: "alumni" };

  if (application) return { kind: "apply", decisionDeadline: ev.decision_deadline };
  return { kind: "rsvp", waitlist: full };
}
