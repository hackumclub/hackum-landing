import Image from "next/image";
import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import Skeleton from "@/components/ui/Skeleton";
import Stage from "@/components/ops/Stage";
import Sticker from "@/components/Sticker";
import type { StickerName } from "@/lib/manul";
import Icon3D from "@/components/Icon3D";
import { cx } from "@/components/ui/cx";

/** Page opener: the blue Hackum stage with a Мануул. One h1 per screen. */
export function PageHeader({ title, aside, sticker, lead }: { title: ReactNode; aside?: ReactNode; sticker?: StickerName; lead?: ReactNode }) {
  return (
    <Stage
      className="mb-5" compact title={title} lead={lead} actions={aside}
      art={sticker ? <Sticker name={sticker} sizes="176px" className="w-[4.25rem] -rotate-3 md:w-40" /> : undefined}
    />
  );
}

export function Section({ title, aside, id, children, className }: { title: string; aside?: ReactNode; id?: string; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cx("grid gap-3", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display text-lg font-bold text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Card: panel + hairline (the ops stylesheet lifts it with a soft shadow); `style` takes a tint wash. */
export function Card({ children, className, style, as: Tag = "div" }: { children: ReactNode; className?: string; style?: React.CSSProperties; as?: "div" | "li" | "article" | "section" }) {
  return <Tag style={style} className={cx("rounded-[var(--radius-md)] border border-line bg-panel p-4", className)}>{children}</Tag>;
}

/** Route-level loading placeholder: a title and a few cards, announced once. */
export function PageSkeleton({ label, cards = 3 }: { label: string; cards?: number }) {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-40" />
      {Array.from({ length: cards }, (_, i) => <Skeleton key={i} className="h-32 w-full rounded-[var(--radius-md)]" />)}
    </div>
  );
}

/**
 * Bottom action bar for forms and flows: a frosted pill pinned to the bottom edge (safe-area aware) on phones, inline from
 * 768px. `aboveTabs` lifts it over the floating tab bar (forms on tab screens); flows that hide the tab bar leave it false.
 */
export function StickyBar({ children, aboveTabs = false, label }: { children: ReactNode; aboveTabs?: boolean; label?: string }) {
  return (
    <div
      role="group" aria-label={label}
      className={cx(
        "fixed inset-x-0 z-30 px-3 md:static md:px-0",
        aboveTabs ? "bottom-[calc(5.25rem+env(safe-area-inset-bottom))]" : "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="mx-auto flex max-w-4xl items-stretch gap-2 rounded-[28px] border border-line bg-[color-mix(in_srgb,var(--ops-panel)_90%,transparent)] p-2 shadow-[0_18px_40px_-18px_rgb(0_60_100/0.6)] backdrop-blur-xl md:rounded-[var(--radius-md)] md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none md:border-0">
        {children}
      </div>
    </div>
  );
}

/** Poster slot with a fixed aspect ratio: the cover, or a soft wash with a 3D ticket when the event has none. Children are overlays. */
export function Poster({ cover, className, greyed, sizes = "(min-width: 768px) 224px, 100vw", children }: { cover: string | null; className?: string; greyed?: boolean; sizes?: string; children?: ReactNode }) {
  return (
    <div className={cx("relative overflow-hidden bg-[radial-gradient(90%_90%_at_80%_10%,var(--ops-accent-soft),var(--ops-ember-soft))]", className)}>
      {cover
        ? <Image src={cover} alt="" fill sizes={sizes} className={cx("object-cover", greyed && "grayscale")} />
        : <div className="absolute inset-0 grid place-items-center"><Icon3D name="ticket" sizes="160px" className="size-28 rotate-6 drop-shadow-[0_14px_16px_rgb(0_40_70/0.3)]" /></div>}
      {/* A soft scrim keeps chips readable over any poster. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent" />
      {children}
    </div>
  );
}

/** Calendar-leaf date chip that sits over a poster: month on top, big day below. */
export function DateChip({ month, day, className }: { month: string; day: string; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("grid min-w-14 justify-items-center rounded-[var(--radius-sm)] bg-panel px-2.5 py-1.5 text-center leading-none shadow-[0_8px_18px_-8px_rgb(0_20_40/0.6)] ring-1 ring-line", className)}>
      <span className="text-xs font-bold text-ember-fg">{month}</span>
      <span className="mt-1 font-display text-xl font-black text-fg tnum">{day}</span>
    </div>
  );
}

/** A soft tinted card tile with a 3D icon, used for settings sections and similar grouped content. */
export function IconCard({ icon, title, line, aside, tone = "accent", id, children, className }: {
  icon: string; title: string; line?: string; aside?: ReactNode; tone?: "accent" | "ok" | "warn" | "ember"; id: string; children: ReactNode; className?: string;
}) {
  const wash = { accent: "var(--ops-accent-soft)", ok: "var(--ops-ok-soft)", warn: "var(--ops-warn-soft)", ember: "var(--ops-ember-soft)" }[tone];
  return (
    <section aria-labelledby={id} className={cx("grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5", className)}>
      <header className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-sm)]" style={{ background: `radial-gradient(100% 100% at 30% 20%, ${wash}, transparent 90%)` }}>
          <Icon3D name={icon} sizes="64px" className="size-10 drop-shadow-[0_6px_8px_rgb(0_40_70/0.25)]" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 id={id} className="font-display text-lg leading-tight font-bold text-fg">{title}</h2>
          {line && <p className="text-sm text-fg-muted">{line}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export type TimelineItem = { state: "done" | "current" | "todo"; icon: LucideIcon; title: string; line?: string; note?: string };

/** Vertical "what happens next" timeline: a filled dot for what is done, a glossy ring for where the person is now, a hollow one for later. */
export function Timeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <ol aria-label={label} className="grid gap-0">
      {items.map((it, i) => {
        const Icon = it.state === "done" ? Check : it.icon;
        const last = i === items.length - 1;
        return (
          <li key={i} aria-current={it.state === "current" ? "step" : undefined} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0">
            {!last && <span aria-hidden="true" className={cx("absolute top-10 bottom-0 left-5 w-0.5 -translate-x-1/2 rounded-full", it.state === "done" ? "bg-ok-fg/50" : "bg-line-strong/40")} />}
            <span aria-hidden="true" className={cx("z-10 grid size-10 place-items-center rounded-full", it.state === "done" ? "bg-ok-soft text-ok-fg" : it.state === "current" ? "ops-gloss" : "border border-line-strong bg-panel text-fg-muted")}>
              <Icon size={18} />
            </span>
            <div className="grid content-center gap-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2 font-bold text-fg">{it.title}{it.note && <span className="text-xs font-semibold text-fg-muted tnum">{it.note}</span>}</p>
              {it.line && <p className="text-sm text-fg-muted">{it.line}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
