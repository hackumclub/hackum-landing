"use client";
import Select from "@/components/ui/Select";
import ListFilters, { type ChipGroup } from "@/components/admin/lists/ListFilters";
import { useListState } from "@/components/admin/lists/useListState";
import type { Locale } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { AUDIT_GROUPS } from "@/lib/members/format";
import { AUDIT_SPEC, ENTITY_KINDS } from "./filter";

/** Chip groups of the audit log: what was done (action) and to what (object). No counts: the server filters and pages. */
export const auditChipGroups = (c: AreaCopy["audit"], lists: AreaCopy["lists"]): ChipGroup[] => [
  { key: "group", label: lists.groups.action, options: AUDIT_GROUPS.map((g) => ({ value: g, label: c.groups[g] })) },
  { key: "entity", label: lists.groups.entity, options: ENTITY_KINDS.map((k) => ({ value: k, label: c.entities[k] })) },
];

/** Filters live in the URL (server-side filtering + pagination), so a filtered view is shareable and survives reloads. */
export default function AuditFilters({ actors, lang, c, lists }: { actors: { id: string; name: string }[]; lang: Locale; c: AreaCopy["audit"]; lists: AreaCopy["lists"] }) {
  const list = useListState(AUDIT_SPEC, { mode: "server" });
  return (
    <div role="search" aria-label={c.filters}>
      <ListFilters
        list={list} groups={auditChipGroups(c, lists)} lang={lang} dates presets={["last30", "thisSemester", "lastSemester", "thisYear"]}
        labels={{ filters: lists.filters, clear: lists.clear, searchLabel: lists.audit.searchLabel, searchPlaceholder: lists.audit.searchPlaceholder }}
      >
        <label className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold whitespace-nowrap text-fg-muted">
          <span className="whitespace-nowrap max-md:sr-only">{c.actorLabel}</span>
          <Select
            variant="filter" aria-label={c.actorLabel} value={list.state.single.actor ?? ""} onValueChange={(v) => list.setSingle("actor", v || null)} className="max-w-56"
            options={[{ value: "", label: c.allActors }, ...actors.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </label>
      </ListFilters>
    </div>
  );
}
