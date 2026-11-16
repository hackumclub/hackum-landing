import type { ReactNode } from "react";
import Skeleton from "@/components/ui/Skeleton";
import { cx } from "@/components/ui/cx";

/** Page title row. One h1 per screen. */
export function PageHeader({ title, aside, children }: { title: string; aside?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-5 grid gap-1">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-fg md:text-3xl">{title}</h1>
        {aside}
      </div>
      {children}
    </header>
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
