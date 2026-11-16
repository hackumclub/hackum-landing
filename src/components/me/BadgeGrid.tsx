import type { MeCopy } from "@/i18n/areas/me";
import { fill } from "@/i18n/config";
import type { Badge, BadgeTier } from "@/lib/me/badges";
import Icon3D from "@/components/Icon3D";
import { cx } from "@/components/ui/cx";
import { BADGE_ART } from "./badgeArt";

const TIER_CHIP: Record<BadgeTier, string> = { bronze: "bg-ember-soft text-ember-fg", silver: "bg-neutral-soft text-fg", gold: "bg-warn-soft text-warn-fg" };

/** Thin progress bar under a locked emblem (decorative: the same facts are in the visible caption and the screen-reader sentence). */
function Progress({ badge }: { badge: Badge }) {
  const { have, need } = badge.progress;
  const pct = need === 0 ? 0 : Math.min(100, Math.round((have / need) * 100));
  return (
    <div aria-hidden="true" className="h-1.5 w-20 overflow-hidden rounded-full bg-neutral-soft">
      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Earned badges in colour; locked ones greyed with a "N to go" ring (Duolingo / Circle pattern). */
export default function BadgeGrid({ badges, c }: { badges: Badge[]; c: MeCopy["badges"] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
      {badges.map((b) => {
        const info = c.items[b.id];
        const left = b.progress.need - b.progress.have;
        const tier = c.tier[b.tier];
        const sr = b.comingSoon ? c.srSoon : b.earned ? c.srEarned : c.srLocked;
        return (
          <li key={b.id} data-badge={b.id} data-earned={b.earned} className={cx("grid content-start justify-items-center gap-2 rounded-[var(--radius-md)] border border-line p-3 text-center", b.earned ? "bg-panel" : "bg-panel-2")}>
            <div className="relative grid size-24 place-items-center">
              <Icon3D name={BADGE_ART[b.id]} dir="badges" sizes="96px" className={cx("size-24 drop-shadow-[0_10px_12px_rgb(0_40_70/0.3)]", !b.earned && "opacity-50 grayscale")} />
            </div>
            {!b.earned && !b.comingSoon ? <Progress badge={b} /> : <div aria-hidden="true" className="h-1.5" />}
            <span className="sr-only">{fill(sr, { name: info.name, tier, have: b.progress.have, need: b.progress.need, left })}</span>
            <div aria-hidden="true" className="grid gap-1">
              <p className={cx("text-sm font-bold", b.earned ? "text-fg" : "text-fg-muted")}>{info.name}</p>
              <p className="text-xs text-fg-muted">{info.how}</p>
              <p className="flex flex-wrap items-center justify-center gap-1.5">
                <span className={cx("rounded-full px-2 py-0.5 text-xs font-bold", TIER_CHIP[b.tier])}>{tier}</span>
                <span className="tnum text-xs font-semibold text-fg-muted">
                  {b.comingSoon ? c.comingSoon : b.earned ? c.earned : fill(c.toGo, { n: left })}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
