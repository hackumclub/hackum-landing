"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CalendarDays, ExternalLink, History, LayoutDashboard, Mail, Menu, Palette, Settings, Users, type LucideIcon } from "lucide-react";
import type { Dict } from "@/i18n";
import { switchLocale, type Locale } from "@/i18n/config";
import { adminNav, type AdminNavKey } from "@/lib/admin/nav";
import IconButton from "@/components/ui/IconButton";
import Drawer from "@/components/ui/Drawer";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { cx } from "@/components/ui/cx";

const ICON: Record<AdminNavKey, LucideIcon> = {
  dashboard: LayoutDashboard, events: CalendarDays, members: Users, comms: Mail, settings: Settings, audit: History, kit: Palette,
};

type T = Dict["admin"];

function SideNav({ lang, t, onNavigate }: { lang: Locale; t: T; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav aria-label={t.nav.label}>
      <ul className="grid gap-0.5">
        {adminNav(lang).map(({ key, href, ready }) => {
          const Icon = ICON[key];
          const active = path === href;
          const inner = (
            <>
              <Icon aria-hidden="true" size={18} />
              <span className="flex-1">{t.nav[key]}</span>
              {!ready && <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-xs font-semibold text-fg-muted">{t.nav.soon}</span>}
            </>
          );
          const cls = "flex min-h-10 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-sm font-semibold";
          return (
            <li key={key}>
              {ready ? (
                <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cx(cls, active ? "bg-accent-soft text-accent-fg" : "text-fg hover:bg-neutral-soft")}>
                  {inner}
                </Link>
              ) : (
                <span aria-disabled="true" className={cx(cls, "cursor-not-allowed text-fg-muted")}>{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand({ t, lang, compact = false }: { t: T; lang: Locale; compact?: boolean }) {
  return (
    <Link href={`/${lang}/admin`} className="inline-flex items-center gap-2 font-display text-base font-bold text-fg">
      <Image src="/img/brand/logo-128.png" alt="" width={28} height={28} className="rounded-md" />
      <span className={compact ? "sr-only min-[440px]:not-sr-only" : undefined}>{t.brand}</span>
    </Link>
  );
}

/** Backoffice frame: sticky sidebar ≥1024px, drawer below; translucent top bar is the screen's one glass surface. */
export default function AdminShell({ lang, t, skip, close, extras, children }: { lang: Locale; t: T; skip: string; close: string; /** Server-rendered controls for the top bar (live badge, persona switcher). */ extras?: ReactNode; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePathname();
  const other: Locale = lang === "mn" ? "en" : "mn";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#main" className="sr-only z-[95] rounded-[var(--radius-sm)] bg-accent px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{skip}</a>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-panel p-4 lg:flex">
        <Brand t={t} lang={lang} />
        <SideNav lang={lang} t={t} />
        <Link href={`/${lang}`} className="mt-auto inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-fg-muted hover:bg-neutral-soft hover:text-fg">
          <ExternalLink aria-hidden="true" size={16} /> {t.nav.viewSite}
        </Link>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--ops-canvas)_82%,transparent)] px-4 backdrop-blur-xl md:px-6">
          <IconButton label={t.nav.openMenu} icon={<Menu size={20} />} className="-ml-2 lg:hidden" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} />
          <div className="lg:hidden"><Brand t={t} lang={lang} compact /></div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">{extras}</div>
            <Link href={switchLocale(path, other)} hrefLang={other} lang={other} aria-label={t.nav.switchLangLabel} className="inline-flex min-h-10 items-center rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-fg hover:bg-neutral-soft">
              {t.nav.switchLang}
            </Link>
            <ThemeToggle labels={{ group: t.theme.group, system: t.theme.system, light: t.theme.light, dark: t.theme.dark }} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <Drawer open={menuOpen} onOpenChange={setMenuOpen} title={t.nav.label} closeLabel={close}>
        <SideNav lang={lang} t={t} onNavigate={() => setMenuOpen(false)} />
        {/* Below 768px the top bar has no room for these; the drawer only mounts while open, so ids stay unique. */}
        {extras && <div className="mt-6 grid gap-3 border-t border-line pt-4 md:hidden">{extras}</div>}
      </Drawer>
    </div>
  );
}
