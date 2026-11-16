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
  /**
   * Hide on narrow screens so the table stays readable. Below `md` every row is a card (title block, then a two-column
   * grid of the other columns, each labelled with its header), so "sm" and "md" columns still show there; "lg" and "xl"
   * columns are dropped from the card too.
   */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** The row's title block (thumbnail, title, tags). It takes the leftover width, and the whole top of the card on phones. */
  primary?: boolean;
  /** Left out of the phone card (long free-text columns); the row's drawer still shows it. */
  hideInCard?: boolean;
  /** Phone card layout: take the full card width instead of half (long values such as "64 applications · 2 accepted"). */
  wide?: boolean;
  /** Fixed column width from md, as Tailwind classes (`md:w-44`), so dates, states and numbers line up row to row. */
  width?: string;
};

// "sm"/"md" columns show in the card layout (< md) and the table (>= md); only lg/xl actually hide.
const HIDE = { sm: "", md: "", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell", "2xl": "hidden 2xl:table-cell" } as const;
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
export default function DataTable<T>({ rows, columns, getId, caption, empty, selectable = false, selectLabel = "Select", selectAllLabel = "Select all", onSelectionChange, onRowClick, pageSize, selectionBar, paginationLabels = DEFAULT_PAGINATION, fixed = false }: {
  rows: T[]; columns: Column<T>[]; getId: (row: T) => string; caption: string; empty: ReactNode;
  selectable?: boolean; selectLabel?: string; selectAllLabel?: string; onSelectionChange?: (ids: string[]) => void;
  /** Pointer convenience: clicking the row (not a button, link or checkbox inside it) opens it. Keyboard users keep the row's own button/link. */
  onRowClick?: (row: T) => void;
  /** Client-side pagination: rows per page. Omit to show everything. */
  pageSize?: number;
  /** Rendered in a sticky bottom bar (above the /me tab bar on phones) while at least one row is selected. */
  selectionBar?: (ids: string[]) => ReactNode;
  paginationLabels?: PaginationLabels;
  /**
   * Fixed table layout from md: columns with a `width` keep exactly that width and the `primary` column takes the rest, so
   * every row and every list lines up. Every non-primary column must then have a `width`. Admin lists use it.
   */
  fixed?: boolean;
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
    <div className="grid grid-cols-1 gap-3">
    {/* From xl the wrapper clips instead of scrolling, so the header can stick to the page (a scroll container would trap it). */}
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-line bg-panel xl:overflow-clip">
      <table role="table" className={cx("w-full border-collapse text-left text-sm max-md:block", fixed && "md:table-fixed")}>
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup" className="xl:sticky xl:top-[var(--table-sticky-top,0px)] xl:z-10 bg-panel-2 text-fg-muted shadow-[0_1px_0_var(--ops-line)] max-md:sr-only">
          <tr role="row">
            {selectable && (
              <th scope="col" className="w-12 py-2.5 pr-0 pl-4">
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
                <th key={c.key} scope="col" aria-sort={c.sortValue ? state : undefined} className={cx("px-4 py-2.5 text-xs font-semibold whitespace-nowrap", c.numeric && "md:text-right", c.hideBelow && HIDE[c.hideBelow], c.hideInCard && "max-md:hidden", c.width)}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggleSort(c.key)} className={cx("inline-flex cursor-pointer items-center gap-1 rounded hover:text-fg", c.numeric && "flex-row-reverse")}>
                      {c.header}
                      <Icon aria-hidden="true" size={14} className={state === "none" ? "opacity-50" : undefined} />
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
            {onRowClick && <td aria-hidden="true" className="w-10 p-0 max-xl:hidden" />}
          </tr>
        </thead>
        <tbody role="rowgroup" className="max-md:block">
          {visible.map((row) => {
            const id = getId(row);
            const isSel = selected.has(id);
            return (
              <tr
                key={id}
                role="row"
                className={cx(
                  "group/row relative border-t border-line transition-colors duration-150 first:border-t-0",
                  // Phones: one card per row. Title block on top, the other columns in a labelled two-column grid below.
                  "max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-3 max-md:p-4",
                  isSel ? "bg-accent-soft" : "hover:bg-panel-2",
                  onRowClick && "cursor-pointer",
                )}
                onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest("a,button,input,label,select,textarea")) onRowClick(row); } : undefined}
              >
                {selectable && (
                  <td role="cell" className="w-12 py-3 pr-0 pl-4 max-md:absolute max-md:top-3.5 max-md:right-3 max-md:w-auto max-md:p-0">
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
                  <td
                    key={c.key}
                    role="cell"
                    data-label={c.primary ? undefined : c.header}
                    className={cx(
                      "px-4 py-3 align-middle text-fg",
                      c.numeric && "tnum md:text-right",
                      c.hideBelow && HIDE[c.hideBelow],
                      c.hideInCard && "max-md:hidden",
                      c.width,
                      // Card layout: no cell padding, labelled meta cells, the primary cell spans the card.
                      "max-md:block max-md:min-w-0 max-md:p-0 max-md:text-left",
                      c.primary ? cx("max-md:col-span-2", selectable && "max-md:pr-8") : cx(c.wide && "max-md:col-span-2", "max-md:before:mb-0.5 max-md:before:block max-md:before:text-xs max-md:before:font-semibold max-md:before:text-fg-muted max-md:before:content-[attr(data-label)]"),
                    )}
                  >
                    {c.cell(row)}
                  </td>
                ))}
                {onRowClick && (
                  <td role="cell" aria-hidden="true" className="w-10 p-0 pr-2 text-right max-xl:hidden">
                    <ChevronRight size={16} className="inline text-fg-muted opacity-0 transition-[opacity,transform] duration-150 group-hover/row:translate-x-0.5 group-hover/row:opacity-100 motion-reduce:transition-none" />
                  </td>
                )}
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
