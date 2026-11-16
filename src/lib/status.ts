// Status vocabularies shared by the backoffice and member app (spec §4 enums). One pill style per value (StatusPill).
export const EVENT_STATUSES = ["draft", "published", "cancelled", "completed", "archived"] as const;
export const REG_STATUSES = ["applied", "going", "waitlisted", "rejected", "cancelled", "attended", "no_show"] as const;
export const MEMBER_STATUSES = ["guest", "member", "alumni"] as const;
export const APPLICATION_STATUSES = ["pending", "approved", "rejected", "withdrawn"] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];
export type RegStatus = (typeof REG_STATUSES)[number];
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
/** "live" is derived (published and happening now), never stored. */
export type Status = EventStatus | RegStatus | MemberStatus | ApplicationStatus | "live";

export const ALL_STATUSES: readonly Status[] = [
  ...new Set<Status>([...EVENT_STATUSES, ...REG_STATUSES, ...MEMBER_STATUSES, ...APPLICATION_STATUSES, "live"]),
];
