import Link from "next/link";
import { copy } from "@/i18n/areas/me";
import { copy as shell } from "@/i18n/areas/shell";
import { fill, type Locale } from "@/i18n/config";
import { computeBadges } from "@/lib/me/badges";
import { getStore } from "@/lib/mockdb/store";
import type { BellData } from "@/lib/notifications/load";
import Icon3D from "@/components/Icon3D";
import { BADGE_ART } from "@/components/me/badgeArt";
import { MarkAllReadButton, NotificationList } from "@/components/notifications/NotificationList";

const card = "grid content-start gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4";

/** Laptop right column of /me: latest notifications and a badges summary. Server component. */
export default function MeAside({ profileId, lang, now, bell }: { profileId: string; lang: Locale; now: Date; bell: BellData }) {
  const t = shell[lang];
  const m = copy[lang];
  const badges = computeBadges(getStore().read(), profileId, now);
  const earned = badges.filter((b) => b.earned);
  return (
    <>
      <section aria-labelledby="aside-notifs" className={card} style={{ background: "radial-gradient(120% 90% at 100% 0%, var(--ops-accent-soft), var(--ops-panel) 62%)" }}>
        <div className="flex min-h-10 items-center justify-between gap-2">
          <h2 id="aside-notifs" className="font-display text-base font-bold text-fg">{t.page.title}</h2>
          <MarkAllReadButton lang={lang} unread={bell.unread} />
        </div>
        {bell.items.length === 0
          ? <p className="text-sm text-fg-muted">{t.bell.empty}</p>
          : <NotificationList items={bell.items.slice(0, 4)} lang={lang} compact />}
        <Link href={`/${lang}/me/notifications`} className="inline-flex min-h-11 items-center text-sm font-bold text-accent-fg hover:underline">{t.bell.seeAll}</Link>
      </section>
      <section aria-labelledby="aside-badges" className={card} style={{ background: "radial-gradient(120% 90% at 100% 0%, var(--ops-warn-soft), var(--ops-panel) 62%)" }}>
        <div className="grid gap-0.5">
          <h2 id="aside-badges" className="font-display text-base font-bold text-fg">{m.profile.badges}</h2>
          <p className="text-sm text-fg-muted">{fill(m.profile.badgesLine, { earned: earned.length, total: badges.length })}</p>
        </div>
        {earned.length > 0 && (
          <ul aria-label={m.profile.badges} className="flex flex-wrap gap-2">
            {earned.slice(0, 5).map((b) => (
              <li key={b.id} title={m.badges.items[b.id].name} className="grid size-12 place-items-center rounded-full bg-neutral-soft">
                <Icon3D name={BADGE_ART[b.id]} dir="badges" sizes="48px" className="size-10" />
                <span className="sr-only">{m.badges.items[b.id].name}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/${lang}/me/profile`} className="inline-flex min-h-11 items-center text-sm font-bold text-accent-fg hover:underline">{m.profile.title}</Link>
      </section>
    </>
  );
}
