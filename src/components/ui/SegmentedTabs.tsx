"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type KeyboardEvent } from "react";
import CountBadge from "./CountBadge";
import { cx } from "./cx";

export type SegmentedItem = { key: string; label: string; count?: number };

type Common = { items: SegmentedItem[]; ariaLabel: string; className?: string };
type InPage = Common & { value: string; onChange: (key: string) => void; hrefs?: undefined };
type Routed = Common & {
  /** key → URL. Each tab is a link, so deep links and Back work. */
  hrefs: Record<string, string>;
  /** Active key. Defaults to the item whose href equals the current pathname. */
  value?: string;
  onChange?: undefined;
};
export type SegmentedTabsProps = InPage | Routed;

const FADE = "max-md:[mask-image:linear-gradient(90deg,#000_calc(100%-36px),transparent)]";
const TAB = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ops-accent)]";
const ON = "bg-panel text-fg shadow-[var(--shadow-soft)] ring-1 ring-line-strong";
const OFF = "text-fg-muted hover:text-fg";

/**
 * One segmented control for both routed tabs (`hrefs`: links with aria-current) and in-page tabs (`value`/`onChange`:
 * role=tablist). Roving tabindex with ArrowLeft/Right (wrapping), Home and End. On phones the row scrolls horizontally
 * and fades at the right edge.
 */
export default function SegmentedTabs(props: SegmentedTabsProps) {
  const { items, ariaLabel, className } = props;
  const pathname = usePathname();
  const refs = useRef<(HTMLElement | null)[]>([]);
  const routed = props.hrefs !== undefined;
  const hrefs = props.hrefs;

  const activeKey = routed
    ? (props.value ?? items.find((i) => hrefs?.[i.key] === pathname)?.key)
    : props.value;
  const activeIndex = items.findIndex((i) => i.key === activeKey);
  // The tab stop sits on the active tab, or the first one when nothing is active (routed tabs on a sub-page).
  const stop = activeIndex >= 0 ? activeIndex : 0;

  const move = (to: number) => {
    const next = (to + items.length) % items.length;
    refs.current[next]?.focus();
    if (!routed) props.onChange(items[next].key);
  };
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") move(i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(i - 1);
    else if (e.key === "Home") move(0);
    else if (e.key === "End") move(items.length - 1);
    else return;
    e.preventDefault();
  };

  const row = (
    <div className="flex w-max min-w-full gap-1 rounded-full bg-neutral-soft p-1">
      {items.map((it, i) => {
        const active = i === activeIndex;
        const cls = cx(TAB, active ? ON : OFF);
        const body = (
          <>
            {it.label}
            {it.count !== undefined && <CountBadge n={it.count} className={active ? "bg-neutral-soft" : "bg-panel"} />}
          </>
        );
        if (hrefs) {
          return (
            <Link
              key={it.key}
              href={hrefs[it.key]}
              ref={(el) => { refs.current[i] = el; }}
              aria-current={active ? "page" : undefined}
              tabIndex={i === stop ? 0 : -1}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cls}
            >
              {body}
            </Link>
          );
        }
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            ref={(el) => { refs.current[i] = el; }}
            aria-selected={active}
            tabIndex={i === stop ? 0 : -1}
            onClick={() => props.onChange(it.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cls}
          >
            {body}
          </button>
        );
      })}
    </div>
  );

  const scroller = cx("-mx-1 overflow-x-auto px-1 py-1", FADE, className);
  return routed ? (
    <nav aria-label={ariaLabel} className={scroller}>{row}</nav>
  ) : (
    <div role="tablist" aria-label={ariaLabel} className={scroller}>{row}</div>
  );
}
