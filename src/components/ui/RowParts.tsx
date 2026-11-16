import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Row anatomy shared by every admin list (events, members, registrations, outbox, forms, responses):
 *
 *   [ leading 48px / rounded-12 ]  title (one line, ellipsis + title attr)           | fixed-width right-hand columns
 *                                  second line: kind Tag, then more Tags (24px, 14px icons)
 *
 * `RowEntity` is the left block (put it in the `primary` column of `DataTable`); `Meta` stacks a value over a smaller
 * second line for the fixed-width columns (date over time, state over attempts).
 */
export function RowEntity({ leading, title, sub, className }: {
  /** 48px visual: poster thumb (`Poster`), `Avatar` (size 48) or an icon tile (`IconTile`). */
  leading?: ReactNode;
  /** The title element: use `RowTitle`, or a link/button with `truncate`. Must stay on one line. */
  title: ReactNode;
  /** Second line: `Tag`s, a kind label, a small status. Same 24px height, vertically centred, wraps with an 8px gap. */
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 items-center gap-3", className)}>
      {leading}
      <div className="grid min-w-0 flex-1 gap-1.5">
        {title}
        {sub && <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">{sub}</div>}
      </div>
    </div>
  );
}

const TITLE = "block min-w-0 max-w-full truncate text-left text-sm leading-5 font-bold text-fg";

/** Row title: one line, ellipsis, full text in `title`. Pass `as` children (a `Link` or `button`) with `className={rowTitleClass}` when it must be interactive. */
export const rowTitleClass = cx(TITLE, "cursor-pointer hover:text-accent-fg hover:underline underline-offset-2");

export function RowTitle({ children, title, className }: { children: string; title?: string; className?: string }) {
  return <span title={title ?? children} className={cx(TITLE, className)}>{children}</span>;
}

/** A 48px rounded tile for rows that have no picture (forms, notifications, audit actors). Decorative. */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return <span aria-hidden="true" className={cx("grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-accent-soft text-accent-fg", className)}>{children}</span>;
}

/** Value over a smaller muted second line (date over time, recipient over priority). */
export function Meta({ primary, secondary, className }: { primary: ReactNode; secondary?: ReactNode; className?: string }) {
  return (
    <span className={cx("grid gap-0.5 leading-5", className)}>
      <span className="text-sm text-fg">{primary}</span>
      {secondary && <span className="tnum text-xs text-fg-muted">{secondary}</span>}
    </span>
  );
}
