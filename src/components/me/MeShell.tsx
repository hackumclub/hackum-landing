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
 * Member app frame. Phones: glass top bar (brand, live pill, avatar) + a solid bottom tab bar with safe-area padding.
 * ≥768px: the tabs move into the top bar and the content is a centred 48rem column. Onboarding hides the tabs.
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
    <div className="min-h-dvh bg-canvas">
      <a href="#main" className="sr-only z-[95] rounded-[var(--radius-sm)] bg-accent px-4 py-2 font-bold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3">{skip}</a>
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--ops-canvas)_82%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center gap-2 px-4 md:px-6">
          <Link href={`/${lang}/me`} className="inline-flex min-h-11 items-center gap-2 font-display text-base font-bold text-fg">
            <Image src="/img/brand/logo-128.png" alt="" width={28} height={28} className="rounded-md" />
            <span>{t.brand}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            {extras}
            <AccountMenu lang={lang} t={t} user={user} />
          </div>
        </div>
        {!onboarding && (
          <nav aria-label={t.label} className="mx-auto hidden w-full max-w-3xl px-6 md:block">
            <ul className="flex gap-1">
              {items.map(({ key, path: href, Icon, match }) => {
                const active = match(path);
                return (
                  <li key={key}>
                    <Link href={href} aria-current={active ? "page" : undefined} className={cx("inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold", active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
                      <Icon aria-hidden="true" size={18} />{label(key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>
      <main id="main" className={cx("mx-auto w-full max-w-3xl px-4 pt-5 md:px-6 md:pb-10", onboarding ? "pb-10" : "pb-28")}>{children}</main>
      {!onboarding && (
        <nav aria-label={t.label} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
          <ul className="mx-auto grid max-w-md grid-cols-4">
            {items.map(({ key, path: href, Icon, match }) => {
              const active = match(path);
              return (
                <li key={key}>
                  <Link href={href} aria-current={active ? "page" : undefined} className={cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold", active ? "text-accent-fg" : "text-fg-muted")}>
                    <span className={cx("grid h-7 w-12 place-items-center rounded-full transition-colors duration-150", active && "bg-accent-soft")}><Icon aria-hidden="true" size={20} /></span>
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
