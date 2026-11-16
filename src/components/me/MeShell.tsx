"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, House, LogOut, Settings, UserRound, type LucideIcon } from "lucide-react";
import { switchLocale, type Locale } from "@/i18n/config";
import type { MeCopy } from "@/i18n/areas/me";
import Avatar, { initials } from "@/components/ui/Avatar";
import { cx } from "@/components/ui/cx";
import { signInAs } from "@/lib/server/auth-actions";
import { ToastProvider } from "./Toast";

type Tab = { key: "home" | "events" | "profile" | "settings"; path: string; Icon: LucideIcon; match: (p: string) => boolean };

const tabs = (lang: Locale): Tab[] => {
  const base = `/${lang}/me`;
  return [
    { key: "home", path: base, Icon: House, match: (p) => p === base },
    { key: "events", path: `${base}/events`, Icon: CalendarDays, match: (p) => p.startsWith(`${base}/events`) || p.startsWith(`${base}/teams`) },
    { key: "profile", path: `${base}/profile`, Icon: UserRound, match: (p) => p.startsWith(`${base}/profile`) || p.startsWith(`${base}/membership`) },
    { key: "settings", path: `${base}/settings`, Icon: Settings, match: (p) => p.startsWith(`${base}/settings`) },
  ];
};

function AccountMenu({ lang, t, user }: { lang: Locale; t: MeCopy["nav"]; user: { name: string; avatar: string | null } | null }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  const other: Locale = lang === "mn" ? "en" : "mn";
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  const item = "flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-fg hover:bg-neutral-soft";
  return (
    <div ref={wrap} className="relative">
      <button ref={button} type="button" aria-label={t.account} aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen((o) => !o)} className="grid size-11 cursor-pointer place-items-center rounded-full">
        {user?.avatar
          ? <Avatar name={user.name} src={user.avatar} size={36} />
          // Initials are drawn with CSS content, not DOM text, so the button's accessible name ("Account menu") never disagrees with visible text.
          : <span aria-hidden="true" data-initials={initials(user?.name ?? "")} className="inline-grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-fg after:content-[attr(data-initials)]" />}
      </button>
      {open && (
        <div id="account-menu" className="absolute top-full right-0 z-40 mt-1 grid w-56 gap-0.5 rounded-[var(--radius-md)] border border-line bg-panel p-1.5 shadow-[var(--shadow-card)]">
          {user && <p className="truncate px-3 py-2 text-sm font-bold text-fg">{user.name}</p>}
          <Link href={`/${lang}/me/profile`} className={item} onClick={() => setOpen(false)}><UserRound aria-hidden="true" size={16} />{t.profile}</Link>
          <Link href={`/${lang}/me/settings`} className={item} onClick={() => setOpen(false)}><Settings aria-hidden="true" size={16} />{t.settings}</Link>
          <Link href={switchLocale(path, other)} hrefLang={other} lang={other} aria-label={t.switchLangLabel} className={item} onClick={() => setOpen(false)}>{t.switchLang}</Link>
          <form action={signInAs}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="handle" value="" />
            <button type="submit" className={cx(item, "cursor-pointer")}><LogOut aria-hidden="true" size={16} />{t.signOut}</button>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * Member app frame in the Hackum look: a floating frosted header (brand, pill tabs from 768px, live pill, account) and, on
 * phones, a floating glass tab bar with a glossy active tab. Onboarding hides the tabs.
 */
export default function MeShell({ lang, t, skip, extras, user, children }: {
  lang: Locale; t: MeCopy["nav"] & { brand: string }; skip: string; extras?: ReactNode; user: { name: string; avatar: string | null } | null; children: ReactNode;
}) {
  const path = usePathname();
  const onboarding = path.endsWith("/me/onboarding");
  const items = tabs(lang);
  const label = (k: Tab["key"]) => t[k];
  return (
    <ToastProvider>
    <div className="ops-canvas min-h-dvh">
      <a href="#main" className="sr-only z-[95] rounded-full bg-accent px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{skip}</a>
      <header className="sticky top-3 z-30 mx-3 mt-3">
        <div className="mx-auto flex min-h-14 w-full max-w-4xl items-center gap-2 rounded-full border border-white/60 bg-[color-mix(in_srgb,var(--ops-panel)_74%,transparent)] px-3 shadow-[0_14px_34px_-22px_rgb(0_60_100/0.55)] backdrop-blur-xl">
          <Link href={`/${lang}/me`} className="inline-flex min-h-11 items-center gap-2.5 pl-1 font-display text-lg font-black text-fg">
            <Image src="/img/brand/logo-128.png" alt="" width={34} height={34} className="rounded-full ring-2 ring-white/70" />
            <span>{t.brand}</span>
          </Link>
          {!onboarding && (
            <nav aria-label={t.label} className="mx-auto hidden md:block">
              <ul className="flex gap-1">
                {items.map(({ key, path: href, Icon, match }) => {
                  const active = match(path);
                  return (
                    <li key={key}>
                      <Link href={href} aria-current={active ? "page" : undefined} className={cx("inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-150", active ? "ops-gloss" : "text-fg-muted hover:bg-neutral-soft hover:text-fg")}>
                        <Icon aria-hidden="true" size={18} />{label(key)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-1">
            {extras}
            <AccountMenu lang={lang} t={t} user={user} />
          </div>
        </div>
      </header>
      <main id="main" className={cx("mx-auto w-full max-w-4xl px-3 pt-4 md:px-4 md:pb-12", onboarding ? "pb-10" : "pb-32")}>{children}</main>
      {!onboarding && (
        <nav aria-label={t.label} className="fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-white/60 bg-[color-mix(in_srgb,var(--ops-panel)_86%,transparent)] pb-[env(safe-area-inset-bottom)] shadow-[0_18px_40px_-18px_rgb(0_60_100/0.6)] backdrop-blur-xl md:hidden">
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
    </ToastProvider>
  );
}
