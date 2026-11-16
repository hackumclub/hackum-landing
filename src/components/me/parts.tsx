import type { ReactNode } from "react";
import Skeleton from "@/components/ui/Skeleton";
import Stage from "@/components/ops/Stage";
import Sticker from "@/components/Sticker";
import type { StickerName } from "@/lib/manul";
import { cx } from "@/components/ui/cx";

/** Page opener: the blue Hackum stage with a Мануул. One h1 per screen. */
export function PageHeader({ title, aside, sticker, lead }: { title: string; aside?: ReactNode; sticker?: StickerName; lead?: ReactNode }) {
  return (
    <Stage
      className="mb-5" compact title={title} lead={lead} actions={aside}
      art={sticker ? <Sticker name={sticker} sizes="176px" className="w-24 -rotate-3 md:w-40" /> : undefined}
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

/** Flat card: panel + hairline. No shadow, no glass. */
export function Card({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "article" | "section" }) {
  return <Tag className={cx("rounded-[var(--radius-md)] border border-line bg-panel p-4", className)}>{children}</Tag>;
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
