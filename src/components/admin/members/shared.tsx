"use client";
// Small building blocks shared by the Members, Comms, Settings and Audit screens (this agent's areas only).
import Link from "next/link";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { usePathname } from "next/navigation";
import { useId, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { Input, Select } from "@/components/ui/Field";
import IconButton from "@/components/ui/IconButton";
import Avatar from "@/components/ui/Avatar";
import Skeleton from "@/components/ui/Skeleton";
import type { L, Locale } from "@/i18n/config";
import { tf } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";

export type Notice = { tone: "ok" | "error"; text: string };

/** Result of a mutation, shown inline under the toolbar. Errors use role="alert", success uses role="status". */
export function NoticeBanner({ notice, onDismiss, dismissLabel }: { notice: Notice | null; onDismiss: () => void; dismissLabel: string }) {
  if (!notice) return null;
  const ok = notice.tone === "ok";
  const Icon = ok ? CheckCircle2 : TriangleAlert;
  return (
    <div role={ok ? "status" : "alert"} className={cx("flex items-start gap-2 rounded-[var(--radius-md)] border border-line px-3 py-2.5 text-sm", ok ? "bg-ok-soft text-ok-fg" : "bg-danger-soft text-danger-fg")}>
      <Icon aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
      <p className="min-w-0 flex-1 font-semibold">{notice.text}</p>
      <IconButton size="sm" label={dismissLabel} icon={<X size={14} />} onClick={onDismiss} className="text-current" />
    </div>
  );
}

export type SectionTab = { href: string; label: string; count?: number; disabledReason?: string };

/** Route tabs like ui/TabNav, plus a disabled state that says why (used for admin-only tabs shown to organizers). */
export function SectionTabs({ label, tabs }: { label: string; tabs: SectionTab[] }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto border-b border-line">
      <ul className="flex gap-1 px-1">
        {tabs.map((t) => {
          const active = path === t.href;
          const base = "inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-sm font-semibold whitespace-nowrap";
          return (
            <li key={t.href}>
              {t.disabledReason ? (
                <span aria-disabled="true" title={t.disabledReason} className={cx(base, "cursor-not-allowed border-transparent text-fg-muted opacity-70")}>
                  {t.label}
                  <span className="sr-only"> ({t.disabledReason})</span>
                </span>
              ) : (
                <Link href={t.href} aria-current={active ? "page" : undefined} className={cx(base, active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
                  {t.label}
                  {t.count !== undefined && <span className="tnum rounded-full bg-neutral-soft px-1.5 text-xs text-fg">{t.count}</span>}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Segment buttons with counts ("All 140 · Members 40"). One is always selected; announced with aria-pressed. */
export function Segments<V extends string>({ label, value, onChange, options }: { label: string; value: V; onChange: (v: V) => void; options: { value: V; label: string; count?: number }[] }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(o.value)}
            className={cx("inline-flex min-h-10 cursor-pointer items-center gap-1.5 border-b-2 px-3 text-sm font-semibold whitespace-nowrap", on ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
            {o.label}
            {o.count !== undefined && <span className="tnum rounded-full bg-neutral-soft px-1.5 text-xs text-fg">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export type PersonLite = { id: string; name: L; handle: string; status?: string; school?: string | null };
export const personName = (p: { name: L; handle: string }, lang: Locale, fallback = "") => (tf(p.name, lang).trim() || fallback || p.handle);

/** Searchable single choice: a filter box narrows a native <select> (keyboard- and screen-reader-friendly, no custom listbox). */
export function PersonPicker({ label, people, value, onChange, lang, c, exclude, error, hint }: {
  label: string; people: PersonLite[]; value: string; onChange: (id: string) => void; lang: Locale;
  c: Pick<AreaCopy["members"]["merge"], "find" | "findPlaceholder" | "noMatches" | "pickPrompt">; exclude?: string; error?: string; hint?: string;
}) {
  const [q, setQ] = useState("");
  const searchId = useId();
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = people.filter((p) => p.id !== exclude);
    const hits = needle ? pool.filter((p) => `${p.name.mn} ${p.name.en} ${p.handle}`.toLowerCase().includes(needle)) : pool;
    const picked = people.find((p) => p.id === value);
    // The current choice stays in the list even when the filter would hide it, so the select never silently resets.
    return (picked && !hits.includes(picked) ? [picked, ...hits] : hits).slice(0, 60);
  }, [people, q, exclude, value]);
  return (
    <div className="grid content-start gap-2">
      <div className="grid gap-1.5">
        <label htmlFor={searchId} className="text-sm font-semibold text-fg">{label} <span className="font-normal text-fg-muted">· {c.find}</span></label>
        <Input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.findPlaceholder} autoComplete="off" />
      </div>
      <Select aria-label={label} aria-invalid={error ? true : undefined} aria-describedby={error ? `${searchId}-err` : undefined} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{c.pickPrompt}</option>
        {matches.map((p) => <option key={p.id} value={p.id}>{personName(p, lang)} · @{p.handle}</option>)}
      </Select>
      {error && <p id={`${searchId}-err`} className="text-sm font-semibold text-danger-fg">{error}</p>}
      {hint && <p className="text-sm text-fg-muted">{hint}</p>}
      {q.trim() && matches.length === 0 && <p className="text-sm text-fg-muted">{c.noMatches}</p>}
    </div>
  );
}

/** Avatar + name, with an optional second line. Names truncate so a table row never forces horizontal page scroll. */
export function PersonCell({ name, sub, size = 32, children }: { name: string; sub?: ReactNode; size?: number; children?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} size={size} />
      <span className="grid min-w-0">
        {children ?? <span className="truncate font-semibold text-fg">{name}</span>}
        {sub && <span className="truncate text-xs text-fg-muted">{sub}</span>}
      </span>
    </span>
  );
}

export type ErrorCopy = AreaCopy["common"]["errors"];
export const errorText = (errors: ErrorCopy, code: string) => (code in errors ? errors[code as keyof ErrorCopy] : errors.server);

/** Move focus to the first invalid control in a form (WCAG 3.3.1: errors inline, focus on the first one). */
export function focusFirstInvalid(root: HTMLElement | null) {
  root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/** Page opener: the blue Hackum stage with a 3D icon (name from /public/img/icons3d). */
export function PageHeader({ title, lead, action, icon }: { title: string; lead?: string; action?: ReactNode; icon?: string }) {
  return (
    <Stage
      compact title={title} lead={lead} actions={action}
      art={icon ? <Icon3D name={icon} sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-44" /> : undefined}
    />
  );
}

/** Same footprint as a loaded table card; pair with a visually hidden status for screen readers. */
export function SectionSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-10" />
      <div aria-hidden="true" className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line">
        {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14 rounded-none bg-panel" />)}
      </div>
    </div>
  );
}
