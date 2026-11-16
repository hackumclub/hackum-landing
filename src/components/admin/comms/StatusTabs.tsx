import Link from "next/link";
import { cx } from "@/components/ui/cx";

export type StatusTab = { value: string; label: string; count: number; href: string };

/** Status tabs as plain links (every tab is a URL: deep links from the dashboard, Back and reload all work). */
export default function StatusTabs({ label, tabs, active }: { label: string; tabs: StatusTab[]; active: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto border-b border-line">
      <ul className="flex gap-1 px-1">
        {tabs.map((t) => (
          <li key={t.value}>
            <Link href={t.href} aria-current={t.value === active ? "page" : undefined} scroll={false}
              className={cx("inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold whitespace-nowrap", t.value === active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
              {t.label}
              <span className="tnum rounded-full bg-neutral-soft px-1.5 text-xs text-fg">{t.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
