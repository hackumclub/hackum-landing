"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { House, type LucideIcon } from "lucide-react";
import { icons } from "@/components/ui/icons";
import type { L, Locale } from "@/i18n/config";
import { copy as shellCopy } from "@/i18n/areas/shell";
import type { StaffRoleName } from "@/lib/mockdb/types";
import type { BellData } from "@/lib/notifications/load";
import AvatarMenu from "@/components/shell/AvatarMenu";
import ContextSwitch from "@/components/shell/ContextSwitch";
import NotificationBell from "@/components/notifications/NotificationBell";
import CountBadge from "@/components/ui/CountBadge";
import type { MeCopy } from "@/i18n/areas/me";
import { cx } from "@/components/ui/cx";
import { ToastProvider } from "./Toast";
import { FlowProvider } from "./flow";

type Tab = { key: "home" | "events" | "profile" | "settings"; path: string; Icon: LucideIcon; match: (p: string) => boolean };

const tabs = (lang: Locale): Tab[] => {
  const base = `/${lang}/me`;
  return [
    { key: "home", path: base, Icon: House, match: (p) => p === base },
    { key: "events", path: `${base}/events`, Icon: icons.event, match: (p) => p.startsWith(`${base}/events`) || p.startsWith(`${base}/teams`) },
    { key: "profile", path: `${base}/profile`, Icon: icons.profile, match: (p) => p.startsWith(`${base}/profile`) || p.startsWith(`${base}/membership`) },
    { key: "settings", path: `${base}/settings`, Icon: icons.settings, match: (p) => p.startsWith(`${base}/settings`) },
  ];
};

/**
 * Member app frame in the Hackum look: a floating frosted header (brand, pill tabs from 768px, account) and, on
 * phones, a floating glass tab bar with a glossy active tab. Onboarding hides the tabs.
 */
export default function MeShell({ lang, t, skip, extras, user, role, bell, demo, rail, aside, children }: {
  lang: Locale; t: MeCopy["nav"] & { brand: string }; skip: string; extras?: ReactNode; user: { name: string; avatar: string | null } | null;
  role: StaffRoleName | null; bell: BellData; demo: { enabled: boolean; personas: { handle: string; label: L }[]; current: string | null };
  /** Laptop (>= 1024px) left rail below the nav, e.g. the next-event card. Server-rendered by the layout. */
  rail?: ReactNode;
  /** Laptop right column on the home page: notifications and badges summary. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname();
  const onboarding = path.endsWith("/me/onboarding");
  // The application form brings its own bottom bar, so the tab bar steps aside while it is on screen (see ./flow).
  const [flow, setFlow] = useState(false);
  const tabBar = !onboarding && !flow;
  const items = tabs(lang);
  const label = (k: Tab["key"]) => t[k];
  // From 1024px the nav moves from the header into a left rail; without a signed-in person there is no rail.
  const railOn = !onboarding && !!user;
  const home = path === `/${lang}/me`;
  const notifPath = `/${lang}/me/notifications`;
  const notifActive = path.startsWith(notifPath);
  const pollsPath = `/${lang}/me/polls`;
  const pollsActive = path.startsWith(pollsPath);
  const railLink = "flex min-h-11 items-center gap-3 rounded-full px-4 text-sm font-bold transition-colors duration-150";
  return (
    <ToastProvider>
    <FlowProvider set={setFlow}>
    <div className={cx("ops-canvas flow-root min-h-dvh", tabBar && "max-md:[--tab-bar:calc(4.75rem+env(safe-area-inset-bottom))]")}>
      <a href="#main" className="sr-only z-[95] rounded-full bg-accent px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{skip}</a>
      <header className="sticky top-3 z-30 mx-3 mt-3">
        <div className={cx("mx-auto flex min-h-14 w-full max-w-4xl items-center gap-2 rounded-full border border-[var(--ops-line)] bg-[color-mix(in_srgb,var(--ops-accent-soft)_34%,color-mix(in_srgb,var(--ops-panel)_72%,transparent))] px-3 shadow-[0_14px_34px_-22px_rgb(0_60_100/0.55)] backdrop-blur-xl", railOn && "lg:max-w-[1280px]")}>
          <Link href={`/${lang}/me`} className="inline-flex min-h-11 items-center gap-2.5 pl-1 font-display text-lg font-black text-fg">
            <Image src="/img/brand/logo-128.png" alt="" width={34} height={34} className="rounded-full ring-2 ring-white/70" />
            <span>{t.brand}</span>
          </Link>
          {!onboarding && (
            <nav aria-label={t.label} className={cx("mx-auto hidden md:block", railOn && "lg:hidden")}>
              <ul className="flex gap-1">
                {items.map(({ key, path: href, Icon, match }) => {
                  const active = match(path);
                  return (
                    <li key={key}>
                      <Link href={href} aria-current={active ? "page" : undefined} className={cx("inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-150", active ? "ops-gloss" : "text-fg-muted hover:bg-neutral-soft hover:text-fg")}>
                        <Icon aria-hidden="true" size={20} />{label(key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1">
            {extras}
            {!onboarding && <ContextSwitch current="me" lang={lang} roles={role ? [role] : []} size="lg" className="mr-1 hidden md:block" />}
            {!onboarding && user && <NotificationBell lang={lang} data={bell} seeAllHref={notifPath} size="lg" />}
            <AvatarMenu lang={lang} area="me" user={user} role={role} unread={bell.unread} demo={demo} langInMenu="always" />
          </div>
        </div>
      </header>
      <div className={cx("mx-auto w-full max-w-4xl", railOn && "lg:grid lg:max-w-[1280px] lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-6 lg:px-3")}>
        {railOn && (
          <div className="hidden lg:block">
            <div className="sticky top-24 grid gap-4 pt-4">
              <nav aria-label={t.label}>
                <ul className="grid gap-1">
                  {items.map(({ key, path: href, Icon, match }) => {
                    const active = match(path);
                    return (
                      <li key={key}>
                        <Link href={href} aria-current={active ? "page" : undefined} className={cx(railLink, active ? "ops-gloss" : "text-fg-muted hover:bg-neutral-soft hover:text-fg")}>
                          <Icon aria-hidden="true" size={20} />{label(key)}
                        </Link>
                      </li>
                    );
                  })}
                  <li>
                    <Link href={pollsPath} aria-current={pollsActive ? "page" : undefined} className={cx(railLink, pollsActive ? "ops-gloss" : "text-fg-muted hover:bg-neutral-soft hover:text-fg")}>
                      <icons.analytics aria-hidden="true" size={20} />{t.polls}
                    </Link>
                  </li>
                  <li>
                    <Link href={notifPath} aria-current={notifActive ? "page" : undefined} className={cx(railLink, notifActive ? "ops-gloss" : "text-fg-muted hover:bg-neutral-soft hover:text-fg")}>
                      <icons.bell aria-hidden="true" size={20} /><span className="flex-1">{shellCopy[lang].menu.notifications}</span>{bell.unread > 0 && <CountBadge n={bell.unread} />}
                    </Link>
                  </li>
                </ul>
              </nav>
              {rail}
            </div>
          </div>
        )}
        <main id="main" className={cx("mx-auto w-full min-w-0 max-w-4xl px-3 pt-4 md:px-4 md:pb-12", onboarding ? "pb-10" : "pb-32", railOn && "lg:max-w-none lg:px-0")}>
          {railOn && home && aside ? (
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
              <div className="min-w-0">{children}</div>
              <div className="hidden gap-4 lg:grid">{aside}</div>
            </div>
          ) : children}
        </main>
      </div>
      {tabBar && (
        <nav aria-label={t.label} className={cx("fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-[var(--ops-line)] bg-[color-mix(in_srgb,var(--ops-panel)_86%,transparent)] pb-[env(safe-area-inset-bottom)] shadow-[0_18px_40px_-18px_rgb(0_60_100/0.6)] backdrop-blur-xl md:hidden")}>
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {items.map(({ key, path: href, Icon, match }) => {
              const active = match(path);
              return (
                <li key={key}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={cx("flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-bold", active ? "text-accent-fg" : "text-fg-muted")}>
                    <span className={cx("grid h-8 w-14 place-items-center rounded-full transition-colors duration-150", active && "ops-gloss")}><Icon aria-hidden="true" size={20} /></span>
                    {label(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
    </FlowProvider>
    </ToastProvider>
  );
}
