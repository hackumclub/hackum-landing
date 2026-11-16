// Pure, client-safe part of the audit log: which filters it has. The URL parser lives in `lib/admin/list-state.ts`
// (every admin list uses it); unknown values in the URL are dropped there.
import type { ListSpec, ListState } from "@/lib/admin/list-state";
import { AUDIT_GROUPS, type EntityKind } from "@/lib/members/format";

export const PAGE_SIZE = 50;
export const ENTITY_KINDS = ["event", "registration", "profile", "application", "staff_role", "season", "notification"] as const satisfies readonly Exclude<EntityKind, "other">[];

/** `?q&group&entity&actor&from&to&page`: the audit log is filtered on the server, so a filtered view is a shareable URL. */
export const AUDIT_SPEC = {
  search: true,
  dates: true,
  multi: { group: AUDIT_GROUPS, entity: ENTITY_KINDS },
  single: { actor: (v: string) => v.length > 0 && v.length <= 64 },
} as const satisfies ListSpec;

export type AuditFilter = ListState;
