"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import Field, { Select } from "@/components/ui/Field";
import FilterBar from "@/components/ui/FilterBar";
import FilterDisclosure from "@/components/ui/FilterDisclosure";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { AUDIT_GROUPS, withQuery } from "@/lib/members/format";
import { RANGES, type AuditFilter, type Range } from "./filter";

/** Filters live in the URL (server-side filtering + pagination), so a filtered view is shareable and survives reloads. */
export default function AuditFilters({ filter, actors, path, c }: { filter: AuditFilter; actors: { id: string; name: string }[]; path: string; c: AreaCopy["audit"] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const go = (next: Partial<Omit<AuditFilter, "page">>) => {
    const f = { ...filter, ...next };
    startTransition(() => router.replace(withQuery(path, { group: f.groups, actor: f.actor, range: f.range }), { scroll: false }));
  };
  const active = filter.groups.length > 0 || filter.actor !== null || filter.range !== null;
  return (
    <div role="search" aria-label={c.filters}>
    <FilterDisclosure label={c.filtersLabel} activeCount={filter.groups.length + (filter.range ? 1 : 0) + (filter.actor ? 1 : 0)}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterBar label={c.groupLabel} value={filter.groups} onChange={(v) => go({ groups: AUDIT_GROUPS.filter((g) => v.includes(g)) })} options={AUDIT_GROUPS.map((g) => ({ value: g, label: c.groups[g] }))} />
        <FilterBar label={c.rangeLabel} value={filter.range ? [filter.range] : []} options={RANGES.map((r) => ({ value: r, label: c.ranges[r] }))}
          onChange={(v) => go({ range: (v.find((x) => x !== filter.range) ?? null) as Range | null })} />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={c.actorLabel} className="w-full max-w-xs">
          {(ctl) => (
            <Select {...ctl} value={filter.actor ?? ""} onChange={(e) => go({ actor: e.target.value || null })}>
              <option value="">{c.allActors}</option>
              {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
        </Field>
        {active && <Button variant="ghost" size="sm" icon={<X aria-hidden="true" size={14} />} onClick={() => go({ groups: [], actor: null, range: null })} className="mb-1">{c.clear}</Button>}
      </div>
    </FilterDisclosure>
    </div>
  );
}
