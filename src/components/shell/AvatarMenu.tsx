"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Languages } from "lucide-react";
import Avatar, { initials } from "@/components/ui/Avatar";
import CountBadge from "@/components/ui/CountBadge";
import { cx } from "@/components/ui/cx";
import { icons } from "@/components/ui/icons";
import { copy } from "@/i18n/areas/shell";
import { switchLocale, type L, type Locale } from "@/i18n/config";
import { signInAs } from "@/lib/server/auth-actions";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { ThemePref } from "@/components/ui/OpsRoot";
import ContextSwitch from "./ContextSwitch";

export type AvatarMenuProps = {
  lang: Locale;
  area: "admin" | "me";
  user: { name: string; avatar: string | null } | null;
  /** Staff role (null for members): drives the context switch shown inside the menu on phones. */
  role: "admin" | "organizer" | null;
  unread: number;
  /** Demo accounts (mock auth only). */
  demo: { enabled: boolean; personas: { handle: string; label: L }[]; current: string | null };
  /** The top bar already shows language and theme from 768px in the backoffice, so the menu repeats them only below that. */
  langInMenu: "always" | "mobile";
  /** Backoffice only: the theme control moves into the menu below 768px, where the top bar has no room. */
  themeLabels?: Record<ThemePref | "group", string>;
  /** "md" = 40px circle (backoffice top bar, same size as the bell); "lg" = 44px target (member app). */
  size?: "md" | "lg";
};

/**
 * Account menu for both shells: Profile, Notifications, Settings, Switch demo account (mock auth only), Sign out.
 * Esc and outside click close it; Esc returns focus to the button.
 */
export default function AvatarMenu({ lang, area, user, role, unread, demo, langInMenu, themeLabels, size = "lg" }: AvatarMenuProps) {
  const t = copy[lang].menu;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  const search = useSearchParams().toString();
  const other: Locale = lang === "mn" ? "en" : "mn";
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const notificationsHref = area === "admin" ? `/${lang}/admin/inbox` : `/${lang}/me/notifications`;
  const item = "flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-fg hover:bg-neutral-soft focus-visible:outline-2 focus-visible:outline-[var(--ops-accent)]";
  const close = () => setOpen(false);
  return (
    <div ref={wrap} className="relative">
      <button ref={button} type="button" aria-label={t.open} aria-expanded={open} aria-controls={open ? "avatar-menu" : undefined} onClick={() => setOpen((o) => !o)} className={cx("grid cursor-pointer place-items-center rounded-full transition-shadow duration-150 hover:shadow-[0_0_0_3px_var(--ops-accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ops-accent)]", size === "md" ? "size-10" : "size-11")}>
        {user?.avatar
          ? <Avatar name={user.name} src={user.avatar} size={size === "md" ? 40 : 36} />
          // Initials come from CSS content, not DOM text, so the accessible name never disagrees with visible text.
          : <span aria-hidden="true" data-initials={initials(user?.name ?? "")} className={cx("inline-grid place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-fg after:content-[attr(data-initials)]", size === "md" ? "size-10" : "size-9")} />}
      </button>
      {open && (
        <div id="avatar-menu" className="absolute top-full right-0 z-40 mt-2 grid max-h-[calc(100dvh-6rem)] w-72 gap-0.5 overflow-y-auto rounded-[var(--radius-md)] border border-line bg-panel p-1.5 shadow-[var(--shadow-card)]">
          {user && <p className="truncate px-3 py-2 text-sm font-bold text-fg">{user.name}</p>}
          {role && <ContextSwitch current={area} lang={lang} roles={[role]} size="lg" className="px-1 pb-2 md:hidden [&>ul]:flex [&>ul>li]:flex-1 [&_a]:w-full [&_a]:justify-center" />}
          <Link href={`/${lang}/me/profile`} className={item} onClick={close}><icons.profile aria-hidden="true" size={20} />{t.profile}</Link>
          <Link href={notificationsHref} className={item} onClick={close}>
            <icons.bell aria-hidden="true" size={20} /><span className="flex-1">{t.notifications}</span>{unread > 0 && <CountBadge n={unread} />}
          </Link>
          <Link href={`/${lang}/me/settings`} className={item} onClick={close}><icons.settings aria-hidden="true" size={20} />{t.settings}</Link>
          <Link
            href={switchLocale(search ? `${path}?${search}` : path, other)} hrefLang={other} lang={other} aria-label={other === "en" ? "Switch to English" : "Монгол хэл рүү шилжих"}
            className={cx(item, langInMenu === "mobile" && "md:hidden")} onClick={close}
          >
            <Languages aria-hidden="true" size={20} />{other === "en" ? "English" : "Монгол"}
          </Link>
          {themeLabels && <div className="px-3 py-1.5 md:hidden"><ThemeToggle labels={themeLabels} size="lg" /></div>}
          {demo.enabled && (
            <details className="group mt-1 border-t border-line pt-1">
              <summary className={cx(item, "cursor-pointer list-none justify-between [&::-webkit-details-marker]:hidden")}>
                <span className="flex items-center gap-2"><icons.passkey aria-hidden="true" size={20} />{t.switchDemo}</span>
                <ChevronDown aria-hidden="true" size={16} className="transition-transform duration-150 group-open:rotate-180" />
              </summary>
              <form action={signInAs} className="grid gap-0.5 pb-1">
                <input type="hidden" name="lang" value={lang} />
                <p className="px-3 pb-1 text-xs text-fg-muted">{t.switchDemoNote}</p>
                {demo.personas.map((p) => (
                  <button key={p.handle} type="submit" name="handle" value={p.handle} aria-current={p.handle === demo.current ? "true" : undefined} className={cx(item, "cursor-pointer justify-between text-left", p.handle === demo.current && "bg-accent-soft")}>
                    <span className="[overflow-wrap:anywhere]">{p.label[lang]}</span>
                    {p.handle === demo.current && <span className="text-xs font-bold text-accent-fg">{t.current}</span>}
                  </button>
                ))}
              </form>
            </details>
          )}
          <form action={signInAs} className="border-t border-line pt-1">
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="handle" value="" />
            <button type="submit" className={cx(item, "cursor-pointer")}><icons.logout aria-hidden="true" size={20} />{t.signOut}</button>
          </form>
        </div>
      )}
    </div>
  );
}
