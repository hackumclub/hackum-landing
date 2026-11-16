"use client";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";
import FilterChips, { type FilterOption } from "./FilterChips";
import FilterDisclosure from "./FilterDisclosure";

export { FilterChips };
export type { FilterOption };

export type FilterBarLabels = { filters: string; clear: string };
const DEFAULT_LABELS: FilterBarLabels = { filters: "Filters", clear: "Clear filters" };

export type FilterBarProps = {
  search?: { value: string; onChange: (v: string) => void; placeholder: string; label: string };
  /** Chip groups (use `FilterChips`). */
  chips?: ReactNode;
  /** A `DateRangePicker` or similar. */
  dateRange?: ReactNode;
  onClear: () => void;
  /** Number of active filters (search counts as one). Drives the badge and the Clear button. */
  activeCount: number;
  /** Search debounce in ms. */
  debounceMs?: number;
  labels?: FilterBarLabels;
  children?: ReactNode;
  className?: string;
};

/** The old chip-group API, kept so existing screens keep working until they move to `chips={<FilterChips …/>}`. */
type LegacyProps = { label: string; options: FilterOption[]; value: string[]; onChange: (v: string[]) => void };

function DebouncedSearch({ search, debounceMs }: { search: NonNullable<FilterBarProps["search"]>; debounceMs: number }) {
  const { value, onChange } = search;
  const [text, setText] = useState(value);
  const emitted = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The parent may reset the value (Clear filters, back/forward): follow it unless it is just echoing what we sent.
  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      clearTimeout(timer.current);
      setText(value);
    }
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <label className="relative block w-full md:w-72">
      <span className="sr-only">{search.label}</span>
      <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-muted" />
      <input
        type="search"
        value={text}
        placeholder={search.placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => { emitted.current = v; onChange(v); }, debounceMs);
        }}
        className="min-h-10 w-full rounded-full border border-line-strong bg-panel pl-10 pr-4 text-sm text-fg placeholder:text-fg-muted"
      />
    </label>
  );
}

function Bar({ search, chips, dateRange, onClear, activeCount, debounceMs = 250, labels = DEFAULT_LABELS, children, className }: FilterBarProps) {
  const hasFolded = Boolean(chips || dateRange || children);
  return (
    <div className={cx("flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center", className)}>
      {search && <DebouncedSearch search={search} debounceMs={debounceMs} />}
      {hasFolded && (
        <FilterDisclosure label={labels.filters} activeCount={activeCount} className="md:contents" contentClassName="gap-3 md:flex md:flex-wrap md:items-center">
          {chips}
          {dateRange}
          {children}
        </FilterDisclosure>
      )}
      {activeCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent-fg hover:bg-accent-soft"
        >
          <X aria-hidden="true" size={16} />
          {labels.clear}
        </button>
      )}
    </div>
  );
}

/**
 * Filter row: debounced search, chips and a date range (inline from md, folded behind "Filters" on phones) and a Clear
 * button that stays visible whenever a filter is active. Passing the legacy `{label, options, value, onChange}` props
 * renders a plain chip group (same as `FilterChips`).
 */
export default function FilterBar(props: FilterBarProps | LegacyProps) {
  if ("options" in props) return <FilterChips {...props} />;
  return <Bar {...props} />;
}
