"use client";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cx } from "./cx";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Present → the column is sortable by this value. */
  sortValue?: (row: T) => string | number;
  /** Right-aligned with tabular figures. */
  numeric?: boolean;
  /** Hide on narrow screens so the table stays readable at 360px without page-level horizontal scroll. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
};

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell" } as const;
type Sort = { key: string; dir: "ascending" | "descending" } | null;

export type PaginationLabels = { nav: string; previous: string; next: string; page: (n: number) => string; showing: (from: number, to: number, total: number) => string };
const DEFAULT_PAGINATION: PaginationLabels = {
  nav: "Pagination", previous: "Previous page", next: "Next page", page: (n) => `Page ${n}`, showing: (a, b, n) => `Showing ${a}–${b} of ${n}`,
};

/** Page numbers to render: all of them up to 7, otherwise first, last and a window around the current one ("…" = gap). */
function pageItems(current: number, count: number): (number | "gap-l" | "gap-r")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "gap-l" | "gap-r")[] = [1];
  const lo = Math.max(2, current - 1), hi = Math.min(count - 1, current + 1);
  if (lo > 2) out.push("gap-l");
  for (let n = lo; n <= hi; n++) out.push(n);
  if (hi < count - 1) out.push("gap-r");
  out.push(count);
  return out;
}

/**
 * Client-side table for ≤500 rows (larger sets paginate on the server). Sticky header, sortable columns with
 * aria-sort, optional row selection with a labelled select-all, optional client pagination (`pageSize`) and a sticky
 * bottom `selectionBar` that only exists while something is selected. Selection survives page changes; the page resets
 * to 1 when the number of rows changes (a filter was applied).
 */
export default function DataTable<T>({ rows, columns, getId, caption, empty, selectable = false, selectLabel = "Select", selectAllLabel = "Select all", onSelectionChange, onRowClick, pageSize, selectionBar, paginationLabels = DEFAULT_PAGINATION }: {
  rows: T[]; columns: Column<T>[]; getId: (row: T) => string; caption: string; empty: ReactNode;
  selectable?: boolean; selectLabel?: string; selectAllLabel?: string; onSelectionChange?: (ids: string[]) => void;
  /** Pointer convenience: clicking the row (not a button, link or checkbox inside it) opens it. Keyboard users keep the row's own button/link. */
  onRowClick?: (row: T) => void;
  /** Client-side pagination: rows per page. Omit to show everything. */
  pageSize?: number;
  /** Rendered in a sticky bottom bar (above the /me tab bar on phones) while at least one row is selected. */
  selectionBar?: (ids: string[]) => ReactNode;
  paginationLabels?: PaginationLabels;
}) {
  const [sort, setSort] = useState<Sort>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageState, setPageState] = useState({ page: 1, rowCount: rows.length });
  if (pageState.rowCount !== rows.length) setPageState({ page: 1, rowCount: rows.length });

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !col?.sortValue) return rows;
    const get = col.sortValue;
    const sign = sort.dir === "ascending" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sign;
    });
  }, [rows, columns, sort]);

  if (rows.length === 0) return <>{empty}</>;

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "ascending" ? "descending" : "ascending" } : { key, dir: "ascending" }));
  const updateSelection = (next: Set<string>) => {
    setSelected(next);
    onSelectionChange?.([...next]);
  };
  const allIds = rows.map(getId);
  const present = new Set(allIds);
  // Ids that were selected and then filtered out must never reach a bulk action.
  const selectedIds = [...selected].filter((id) => present.has(id));
  const allSelected = selectedIds.length > 0 && allIds.every((id) => selected.has(id));

  const size = pageSize && pageSize > 0 ? Math.floor(pageSize) : 0;
  const pageCount = size ? Math.max(1, Math.ceil(sorted.length / size)) : 1;
  const page = Math.min(pageState.page, pageCount);
  const from = size ? (page - 1) * size : 0;
  const visible = size ? sorted.slice(from, from + size) : sorted;
  const goTo = (n: number) => setPageState({ page: Math.min(Math.max(1, n), pageCount), rowCount: rows.length });

  const PL = paginationLabels;
  return (
    <div className="grid gap-3">
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-panel">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-10 bg-panel-2 text-fg-muted">
          <tr>
            {selectable && (
              <th scope="col" className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={selectAllLabel}
                  checked={allSelected}
                  onChange={() => updateSelection(allSelected ? new Set() : new Set(allIds))}
                  className="size-5 cursor-pointer accent-[var(--ops-accent)]"
                />
              </th>
            )}
            {columns.map((c) => {
              const state = sort?.key === c.key ? sort.dir : "none";
              const Icon = state === "ascending" ? ArrowUp : state === "descending" ? ArrowDown : ArrowUpDown;
              return (
                <th key={c.key} scope="col" aria-sort={c.sortValue ? state : undefined} className={cx("px-3 py-2 font-semibold whitespace-nowrap", c.numeric && "text-right", c.hideBelow && HIDE[c.hideBelow])}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex cursor-pointer items-center gap-1 rounded hover:text-fg">
                      {c.header}
                      <Icon aria-hidden="true" size={14} className={state === "none" ? "opacity-50" : undefined} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const id = getId(row);
            const isSel = selected.has(id);
            return (
              <tr
                key={id}
                className={cx("border-t border-line", isSel ? "bg-accent-soft" : "hover:bg-panel-2", onRowClick && "cursor-pointer")}
                onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest("a,button,input,label,select,textarea")) onRowClick(row); } : undefined}
              >
                {selectable && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label={selectLabel}
                      checked={isSel}
                      onChange={() => {
                        const next = new Set(selected);
                        if (isSel) next.delete(id); else next.add(id);
                        updateSelection(next);
                      }}
                      className="size-5 cursor-pointer accent-[var(--ops-accent)]"
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cx("px-3 py-2.5 text-fg", c.numeric && "tnum text-right", c.hideBelow && HIDE[c.hideBelow])}>{c.cell(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {size > 0 && pageCount > 1 && (
      <nav aria-label={PL.nav} className="flex flex-wrap items-center justify-between gap-3">
        <p className="tnum text-sm text-fg-muted" aria-live="polite">{PL.showing(from + 1, Math.min(from + size, sorted.length), sorted.length)}</p>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={PL.previous} disabled={page === 1} onClick={() => goTo(page - 1)} className="inline-grid size-10 cursor-pointer place-items-center rounded-full text-fg hover:bg-neutral-soft disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          {pageItems(page, pageCount).map((it) =>
            typeof it === "string" ? (
              <span key={it} aria-hidden="true" className="px-1 text-fg-muted">…</span>
            ) : (
              <button
                key={it} type="button" title={PL.page(it)} aria-current={it === page ? "page" : undefined} onClick={() => goTo(it)}
                className={cx("tnum inline-grid size-10 cursor-pointer place-items-center rounded-full text-sm font-semibold", it === page ? "bg-accent text-on-accent" : "text-fg hover:bg-neutral-soft")}
              >
                {it}
              </button>
            ),
          )}
          <button type="button" aria-label={PL.next} disabled={page === pageCount} onClick={() => goTo(page + 1)} className="inline-grid size-10 cursor-pointer place-items-center rounded-full text-fg hover:bg-neutral-soft disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </nav>
    )}
    {selectionBar && selectedIds.length > 0 && (
      <div className="sticky bottom-[calc(var(--tab-bar,0px)+0.75rem)] z-20 rounded-[var(--radius-md)] border border-line bg-panel p-3 shadow-[var(--shadow-float)]">
        {selectionBar(selectedIds)}
      </div>
    )}
    </div>
  );
}
