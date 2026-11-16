import type { MeCopy } from "@/i18n/areas/me";
import { fill } from "@/i18n/config";
import type { Badge, BadgeTier } from "@/lib/me/badges";
import Icon3D from "@/components/Icon3D";
import { cx } from "@/components/ui/cx";
import { BADGE_ART } from "./badgeArt";

const R = 34;
const CIRC = 2 * Math.PI * R;
/** Earned ring colour follows the tier; the progress arc of a locked badge is always the accent. */
const TIER_STROKE: Record<BadgeTier, string> = { bronze: "stroke-ember", silver: "stroke-c5", gold: "stroke-c2" };
const TIER_CHIP: Record<BadgeTier, string> = { bronze: "bg-ember-soft text-ember-fg", silver: "bg-neutral-soft text-fg", gold: "bg-warn-soft text-warn-fg" };

/** Progress ring around the badge art (decorative: the same facts are in the visible caption and the screen-reader sentence). */
function Ring({ badge }: { badge: Badge }) {
  const { have, need } = badge.progress;
  const frac = badge.earned ? 1 : need === 0 ? 0 : have / need;
  return (
    <svg aria-hidden="true" viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
      <circle cx="40" cy="40" r={R} fill="none" strokeWidth="5" className="stroke-line" />
      {frac > 0 && (
        <circle cx="40" cy="40" r={R} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${CIRC * frac} ${CIRC}`}
          className={badge.earned ? TIER_STROKE[badge.tier] : "stroke-accent"} />
      )}
    </svg>
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
            <div className="relative size-20">
              <Ring badge={b} />
              <Icon3D name={BADGE_ART[b.id]} sizes="56px" className={cx("absolute inset-0 m-auto size-12", !b.earned && "opacity-45 grayscale")} />
            </div>
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
