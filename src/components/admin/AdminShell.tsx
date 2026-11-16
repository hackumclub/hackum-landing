"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ExternalLink, FileChartColumn, ListChecks, Menu, Palette, type LucideIcon } from "lucide-react";
import type { Dict } from "@/i18n";
import { switchLocale, type Locale } from "@/i18n/config";
import { adminNav, type AdminNavKey } from "@/lib/admin/nav";
import { copy as shellCopy } from "@/i18n/areas/shell";
import { copy as pollsCopy } from "@/i18n/areas/admin-polls";
import { copy as reportsCopy } from "@/i18n/areas/admin-reports";
import type { L } from "@/i18n/config";
import type { StaffRoleName } from "@/lib/mockdb/types";
import type { BellData } from "@/lib/notifications/load";
import AvatarMenu from "@/components/shell/AvatarMenu";
import ContextSwitch from "@/components/shell/ContextSwitch";
import NotificationBell from "@/components/notifications/NotificationBell";
import IconButton from "@/components/ui/IconButton";
import Drawer from "@/components/ui/Drawer";
import { icons } from "@/components/ui/icons";
import ThemeToggle from "@/components/ui/ThemeToggle";
import Sticker from "@/components/Sticker";
import { cx } from "@/components/ui/cx";

const ICON: Record<AdminNavKey, LucideIcon> = {
  dashboard: icons.dashboard, events: icons.event, members: icons.member, forms: icons.form, polls: ListChecks, analytics: icons.analytics, reports: FileChartColumn, comms: icons.comms, inbox: icons.inbox,
  settings: icons.settings, audit: icons.audit, kit: Palette,
};

type T = Dict["admin"];

/** Navigation for the brand-blue sidebar (also used inside the mobile drawer on a blue card): white text, frosted hover, white active pill. */
function SideNav({ lang, t, role, onNavigate }: { lang: Locale; t: T; role: StaffRoleName; onNavigate?: () => void }) {
  const path = usePathname();
  // Labels for the sections added in v2 live in the shell copy (the shared dictionaries are frozen).
  const labels: Record<string, string> = { ...t.nav, ...shellCopy[lang].nav, polls: pollsCopy[lang].nav, reports: reportsCopy[lang].nav };
  return (
    <nav aria-label={t.nav.label}>
      <ul className="grid gap-1">
        {adminNav(lang, role).map(({ key, href, ready }) => {
          const Icon = ICON[key];
          // Sections below the first level (e.g. /admin/events/<id>) keep their parent highlighted.
          const active = key === "dashboard" ? path === href : path === href || path.startsWith(`${href}/`);
          const inner = (
            <>
              <Icon aria-hidden="true" size={20} />
              <span className="flex-1">{labels[key]}</span>
              {!ready && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-[var(--ops-on-chrome)]">{t.nav.soon}</span>}
            </>
          );
          const cls = "flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-bold transition-colors duration-150";
          return (
            <li key={key}>
              {ready ? (
                <Link
                  href={href} onClick={onNavigate} aria-current={active ? "page" : undefined}
                  className={cx(cls, active ? "bg-[var(--ops-chrome-active-bg)] text-[var(--ops-chrome-active-fg)] shadow-[0_8px_18px_-10px_rgb(0_20_40/0.7)]" : "text-[var(--ops-on-chrome-muted)] hover:bg-white/12 hover:text-[var(--ops-on-chrome)]")}
                >
                  {inner}
                </Link>
              ) : (
                <span aria-disabled="true" className={cx(cls, "cursor-not-allowed text-[var(--ops-on-chrome-muted)] opacity-80")}>{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Brand({ t, lang, tone = "page", compact = false }: { t: T; lang: Locale; tone?: "page" | "chrome"; compact?: boolean }) {
  return (
    <Link href={`/${lang}/admin`} className={cx("inline-flex items-center gap-2.5 font-display text-lg font-black", tone === "chrome" ? "text-[var(--ops-on-chrome)]" : "text-fg")}>
      <Image src="/img/brand/logo-128.png" alt="" width={34} height={34} className="rounded-full ring-2 ring-white/70" />
      <span className={cx("whitespace-nowrap", compact && "sr-only min-[440px]:not-sr-only")}>{t.brand}</span>
    </Link>
  );
}

/**
 * Backoffice frame in the Hackum look: a floating brand-blue sidebar (≥1024px; a drawer below) with the mascot, a
 * floating frosted top bar like the public header, and the page backdrop with soft brand glows.
 */
export default function AdminShell({ lang, t, skip, close, role, user, bell, demo, extras, children }: {
  lang: Locale; t: T; skip: string; close: string; role: StaffRoleName;
  user: { name: string; avatar: string | null } | null; bell: BellData;
  demo: { enabled: boolean; personas: { handle: string; label: L }[]; current: string | null };
  /** Render-nothing helpers for the top bar (live refresh). */ extras?: ReactNode; children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePathname();
  const search = useSearchParams().toString();
  const other: Locale = lang === "mn" ? "en" : "mn";
  return (
    <div className="ops-canvas min-h-dvh lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
      <a href="#main" className="sr-only z-[95] rounded-full bg-accent px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{skip}</a>
      <aside className="ops-chrome sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] flex-col gap-6 overflow-hidden rounded-[32px] p-5 shadow-[0_30px_60px_-34px_rgb(0_40_80/0.8)] lg:flex">
        <Brand t={t} lang={lang} tone="chrome" />
        <SideNav lang={lang} t={t} role={role} />
        <div className="mt-auto grid gap-3">
          <Sticker name="coffee" className="mx-auto w-28 -rotate-3" sizes="112px" />
          <Link href={`/${lang}`} className="ops-glass inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold hover:bg-white/25">
            <ExternalLink aria-hidden="true" size={16} /> {t.nav.viewSite}
          </Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-3 z-30 mx-3 mt-3 flex min-h-14 items-center gap-2 py-2 rounded-full border border-[var(--ops-line)] bg-[color-mix(in_srgb,var(--ops-accent-soft)_34%,color-mix(in_srgb,var(--ops-panel)_72%,transparent))] px-3 shadow-[0_14px_34px_-22px_rgb(0_60_100/0.55)] backdrop-blur-xl lg:ml-0">
          <IconButton label={t.nav.openMenu} icon={<Menu size={20} />} className="rounded-full bg-seg-track lg:hidden" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} />
          <div className="lg:hidden"><Brand t={t} lang={lang} compact /></div>
          <div className="ml-auto flex items-center gap-2">
            {extras}
            <ContextSwitch current="admin" lang={lang} roles={[role]} collapse className="hidden md:block" />
            <Link href={switchLocale(search ? `${path}?${search}` : path, other)} hrefLang={other} lang={other} aria-label={t.nav.switchLangLabel} className="hidden h-10 items-center rounded-full px-3.5 text-sm font-bold text-fg transition-colors duration-150 hover:bg-neutral-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ops-accent)] md:inline-flex">
              {t.nav.switchLang}
            </Link>
            <div className="hidden md:block"><ThemeToggle labels={{ group: t.theme.group, system: t.theme.system, light: t.theme.light, dark: t.theme.dark }} /></div>
            <NotificationBell lang={lang} data={bell} seeAllHref={`/${lang}/admin/inbox`} />
            <AvatarMenu size="md" lang={lang} area="admin" user={user} role={role} unread={bell.unread} demo={demo} langInMenu="mobile" themeLabels={{ group: t.theme.group, system: t.theme.system, light: t.theme.light, dark: t.theme.dark }} />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1240px] px-3 pt-4 pb-12 [--table-sticky-top:4.75rem] md:px-4 lg:pr-4">{children}</main>
      </div>
      <Drawer open={menuOpen} onOpenChange={setMenuOpen} title={t.nav.label} closeLabel={close}>
        <div className="ops-chrome grid gap-4 rounded-[28px] p-3">
          <SideNav lang={lang} t={t} role={role} onNavigate={() => setMenuOpen(false)} />
          <Sticker name="coffee" className="mx-auto w-24 -rotate-3" sizes="96px" />
        </div>
      </Drawer>
    </div>
  );
}
