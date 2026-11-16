import Link from "next/link";
import { cx } from "@/components/ui/cx";
import { icons } from "@/components/ui/icons";
import { copy } from "@/i18n/areas/shell";
import type { Locale } from "@/i18n/config";

/** Roles that may cross between the backoffice and the member app. Everyone else never sees the control. */
export const canSwitchContext = (roles: readonly string[] | null | undefined) => !!roles?.some((r) => r === "admin" || r === "organizer");

/**
 * Segmented "Dashboard · Hackum · Site" for staff. `current` is the area on screen (aria-current="page"); Site leaves for
 * the public website in the same tab and is never "current". Plain links, so it works without JavaScript and keeps the session.
 * Look: a soft tinted track (40px overall at `md`) with a raised chip for the current area, no outline; each segment
 * has a 16px icon and an 8px gap. `collapse` hides the labels (still the accessible names) below 1024px.
 */
export default function ContextSwitch({ current, lang, roles, size = "md", collapse = false, className }: { current: "admin" | "me"; lang: Locale; roles: readonly string[] | null | undefined; size?: "md" | "lg"; collapse?: boolean; className?: string }) {
  if (!canSwitchContext(roles)) return null;
  const t = copy[lang].ctx;
  const items = [
    { key: "admin" as const, label: t.dashboard, href: `/${lang}/admin`, Icon: icons.dashboard },
    { key: "me" as const, label: t.hackum, href: `/${lang}/me`, Icon: icons.member },
    { key: "site" as const, label: t.site, href: `/${lang}`, Icon: icons.site },
  ];
  return (
    <nav aria-label={t.label} className={className}>
      <ul className="flex w-fit items-center gap-0.5 rounded-full bg-seg-track p-1">
        {items.map(({ key, label, href, Icon }) => {
          const active = key === current;
          return (
            <li key={key}>
              <Link
                href={href} aria-current={active ? "page" : undefined} title={collapse ? label : undefined}
                className={cx(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full text-sm font-bold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ops-accent)]",
                  size === "lg" ? "h-11 px-4" : "h-8 px-3.5",
                  collapse && "max-lg:px-2.5",
                  active ? "bg-seg-chip text-fg shadow-raise" : "text-fg-muted hover:bg-seg-chip/50 hover:text-fg",
                )}
              >
                <Icon aria-hidden="true" size={size === "lg" ? 18 : 16} className="shrink-0" />
                <span className={collapse ? "max-lg:sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
