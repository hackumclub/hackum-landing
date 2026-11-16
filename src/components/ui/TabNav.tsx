"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./cx";

/** Route-based tabs (each tab is a URL, so deep links and Back work). Active tab gets aria-current="page". */
export default function TabNav({ label, tabs }: { label: string; tabs: { href: string; label: string; count?: number }[] }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto border-b border-line">
      <ul className="flex gap-1 px-1">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={cx("inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold whitespace-nowrap", active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
                {t.label}
                {t.count !== undefined && <span className="tnum rounded-full bg-neutral-soft px-1.5 text-xs text-fg">{t.count}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
