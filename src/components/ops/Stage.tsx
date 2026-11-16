import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * The big rounded blue panel every backoffice / member-app / sign-in page opens with: the Hackum hero's little sibling
 * (brand gradient, white Montserrat title, floating mascot or 3D art). One <h1> per page lives here.
 * `art` is decorative (Sticker / Icon3D, already aria-hidden): top-right on phones, bottom-right from 768px.
 */
export default function Stage({ title, lead, kicker, actions, art, compact = false, className, children }: {
  title: ReactNode; lead?: ReactNode; kicker?: ReactNode; actions?: ReactNode; art?: ReactNode; compact?: boolean; className?: string; children?: ReactNode;
}) {
  return (
    <section data-stage className={cx("ops-stage", compact ? "min-h-28 px-5 py-6 md:px-9 md:py-8" : "px-5 py-8 md:px-12 md:py-12", className)}>
      <div className={cx("relative z-10 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center", art ? "pr-16 md:pr-0" : undefined)}>
        <div className="min-w-0">
          {kicker && <p className="mb-2 text-sm font-bold text-[var(--ops-on-stage-lead)]">{kicker}</p>}
          <h1 className={cx("font-display font-black leading-[1.04] [overflow-wrap:anywhere]", compact ? "text-[clamp(28px,4.2vw,44px)]" : "text-[clamp(32px,5.2vw,60px)]")}>{title}</h1>
          {lead && <p className="mt-3 max-w-xl text-base text-[var(--ops-on-stage-lead)] md:text-lg">{lead}</p>}
          {actions && <div className="mt-5 flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {art && <div aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 w-[4.75rem] -translate-y-1/2 md:static md:w-auto md:translate-y-0 md:self-end">{art}</div>}
      </div>
      {children}
    </section>
  );
}
