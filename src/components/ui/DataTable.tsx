"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
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

/**
 * Client-side table for ≤500 rows (larger sets paginate on the server). Sticky header, sortable columns with
 * aria-sort, optional row selection with a labelled select-all.
 */
export default function DataTable<T>({ rows, columns, getId, caption, empty, selectable = false, selectLabel = "Select", selectAllLabel = "Select all", onSelectionChange, onRowClick }: {
  rows: T[]; columns: Column<T>[]; getId: (row: T) => string; caption: string; empty: ReactNode;
  selectable?: boolean; selectLabel?: string; selectAllLabel?: string; onSelectionChange?: (ids: string[]) => void;
  /** Pointer convenience: clicking the row (not a button, link or checkbox inside it) opens it. Keyboard users keep the row's own button/link. */
  onRowClick?: (row: T) => void;
}) {
  const [sort, setSort] = useState<Sort>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
  const allSelected = selected.size > 0 && allIds.every((id) => selected.has(id));

  return (
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
          {sorted.map((row) => {
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
  );
}
