"use client";
// Small building blocks shared by the Members, Comms, Settings and Audit screens (this agent's areas only).
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { useId, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { Input } from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import IconButton from "@/components/ui/IconButton";
import Avatar from "@/components/ui/Avatar";
import { RowEntity, RowTitle } from "@/components/ui/RowParts";
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

export type PersonLite = { id: string; name: L; handle: string; status?: string; school?: string | null };
export const personName = (p: { name: L; handle: string }, lang: Locale, fallback = "") => (tf(p.name, lang).trim() || fallback || p.handle);

/** Searchable single choice: a filter box narrows a themed `Select` (the themed `Select`). */
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
      <Select
        aria-label={label} aria-invalid={error ? true : undefined} aria-describedby={error ? `${searchId}-err` : undefined} value={value} onValueChange={onChange}
        options={[{ value: "", label: c.pickPrompt }, ...matches.map((p) => ({ value: p.id, label: `${personName(p, lang)} · @${p.handle}` }))]}
      />
      {error && <p id={`${searchId}-err`} className="text-sm font-semibold text-danger-fg">{error}</p>}
      {hint && <p className="text-sm text-fg-muted">{hint}</p>}
      {q.trim() && matches.length === 0 && <p className="text-sm text-fg-muted">{c.noMatches}</p>}
    </div>
  );
}

/** Avatar (40px) + name on one line with ellipsis, optional second line: the people version of the shared row anatomy. */
export function PersonCell({ name, sub, size = 40, src, children }: { name: string; sub?: ReactNode; size?: number; src?: string | null; children?: ReactNode }) {
  return (
    <RowEntity
      leading={<Avatar name={name} src={src} size={size} />}
      title={children ?? <RowTitle>{name}</RowTitle>}
      sub={sub ? <span className="min-w-0 truncate text-xs leading-6 text-fg-muted">{sub}</span> : undefined}
    />
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
      art={icon ? <Icon3D name={icon} sizes="208px" className="ml-auto block w-14 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-44" /> : undefined}
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
