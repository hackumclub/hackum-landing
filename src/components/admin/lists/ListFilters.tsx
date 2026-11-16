"use client";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import DateRangePicker from "@/components/ui/DateRangePicker";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar, { FilterChips, type FilterOption } from "@/components/ui/FilterBar";
import Button from "@/components/ui/Button";
import { CHIP_H, chipClass } from "@/components/ui/control";
import type { Locale } from "@/i18n/config";
import type { RangePreset } from "@/lib/date-range";
import type { StickerName } from "@/lib/manul";
import type { ListApi } from "./useListState";

export type ChipGroup = { key: string; label: string; options: FilterOption[] };
export type ListLabels = { filters: string; clear: string; searchLabel: string; searchPlaceholder: string };

/** The one filter row of every admin list: search, chip groups, an optional date range, and "Clear filters". */
export default function ListFilters({ list, labels, groups, lang, dates, presets = ["thisSemester", "lastSemester", "last30", "thisYear"], search = true, children }: {
  list: ListApi; labels: ListLabels; groups: ChipGroup[]; lang: Locale;
  dates?: boolean; presets?: RangePreset[]; search?: boolean; children?: ReactNode;
}) {
  const { state } = list;
  return (
    <FilterBar
      search={search ? { value: state.q, onChange: list.setQ, placeholder: labels.searchPlaceholder, label: labels.searchLabel } : undefined}
      chips={groups.map((g) => (
        <FilterChips key={g.key} showLabel label={g.label} options={g.options} value={state.multi[g.key] ?? []} onChange={(v) => list.setMulti(g.key, v)} />
      ))}
      dateRange={dates ? <DateRangePicker value={state.from && state.to ? { from: state.from, to: state.to } : null} onChange={list.setRange} presets={presets} lang={lang} /> : undefined}
      onClear={list.clear}
      activeCount={list.count}
      labels={{ filters: labels.filters, clear: labels.clear }}
    >
      {children}
    </FilterBar>
  );
}

/** A preset that arrived from a dashboard link (`?filter=…`), shown as a chip that can be removed. */
export function PresetChip({ label, removeLabel, onRemove }: { label: string; removeLabel: string; onRemove: () => void }) {
  return (
    <button
      type="button" onClick={onRemove} aria-label={removeLabel}
      className={chipClass(true, CHIP_H)}
    >
      {label}<X aria-hidden="true" size={14} />
    </button>
  );
}

/** "No results" that says what filtered the list and offers one way out. */
export function NoResults({ list, title, line, summary, clearLabel, sticker = "search" }: {
  list: ListApi; title: string; line: string; /** Already worded, e.g. "“bat”, Status: Applied". Empty when nothing is active. */ summary: string; clearLabel: string; sticker?: StickerName;
}) {
  return (
    <EmptyState
      sticker={sticker} title={title} line={summary ? `${line} ${summary}` : line}
      action={list.count > 0 ? <Button variant="secondary" onClick={list.clear}>{clearLabel}</Button> : undefined}
    />
  );
}

/** Worded list of the active filters for `NoResults`: `“bat” · Status: Applied, Going · Dates: Sep 1 – Dec 31`. */
export function describeFilters({ list, groups, dateText, quoteQ }: { list: ListApi; groups: ChipGroup[]; dateText?: string; quoteQ: (q: string) => string }): string {
  const parts: string[] = [];
  if (list.state.q.trim()) parts.push(quoteQ(list.state.q.trim()));
  for (const g of groups) {
    const picked = (list.state.multi[g.key] ?? []).map((v) => g.options.find((o) => o.value === v)?.label ?? v);
    if (picked.length) parts.push(`${g.label}: ${picked.join(", ")}`);
  }
  if (dateText && list.state.from && list.state.to) parts.push(dateText);
  return parts.join(" · ");
}
