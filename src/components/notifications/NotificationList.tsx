"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { icons, statusIcon } from "@/components/ui/icons";
import Button from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { copy } from "@/i18n/areas/shell";
import type { Locale } from "@/i18n/config";
import type { InboxKind } from "@/lib/mockdb/types";
import type { InboxRow } from "@/lib/notifications/load";
import { loadMoreAction, markAllReadAction, markReadAction } from "@/lib/notifications/actions";

const ICON_OF = (kind: InboxKind) => {
  if (kind.startsWith("application_")) return statusIcon("applied");
  if (kind.startsWith("membership_")) return icons.member;
  if (kind === "staff_application") return statusIcon("pending");
  if (kind === "staff_failed_email") return icons.warning;
  if (kind === "announcement" || kind === "welcome") return icons.comms;
  return icons.event;
};

/**
 * The rows, shared by the bell panel and the full pages. An unread row is tinted, has a dot and says "Unread" to screen
 * readers (never colour alone). Opening a row marks just that row read; showing the list marks nothing.
 */
export function NotificationList({ items, lang, onOpen, compact = false }: { items: InboxRow[]; lang: Locale; onOpen?: () => void; compact?: boolean }) {
  const t = copy[lang];
  const router = useRouter();
  const read = (r: InboxRow) => { if (r.unread) void markReadAction([r.id]).then(() => router.refresh()); };
  const row = cx("relative flex w-full items-start gap-3 rounded-[var(--radius-md)] px-3 text-left", compact ? "min-h-14 py-2.5" : "min-h-16 py-3.5");
  return (
    <ul aria-label={t.page.list} className="grid gap-1">
      {items.map((r) => {
        const Icon = ICON_OF(r.kind);
        const body = (
          <>
            <span aria-hidden="true" className={cx("mt-0.5 grid size-9 shrink-0 place-items-center rounded-full", r.unread ? "bg-accent text-on-accent" : "bg-neutral-soft text-fg-muted")}><Icon size={18} /></span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className={cx("text-sm [overflow-wrap:anywhere] text-fg", r.unread ? "font-extrabold" : "font-semibold")}>
                {r.unread && <span className="sr-only">{t.bell.unread}: </span>}{r.title}
              </span>
              <span className="text-sm [overflow-wrap:anywhere] text-fg-muted">{r.line}</span>
              <span className="text-xs text-fg-muted">{r.when}</span>
            </span>
            {r.unread && <span aria-hidden="true" className="mt-2 size-2.5 shrink-0 rounded-full bg-accent" />}
          </>
        );
        const tint = r.unread ? "bg-accent-soft" : "hover:bg-neutral-soft";
        return (
          <li key={r.id} data-unread={r.unread ? "true" : "false"}>
            {r.href
              ? <Link href={r.href} onClick={() => { read(r); onOpen?.(); }} className={cx(row, tint, "transition-colors duration-150 hover:brightness-[0.98]")}>{body}</Link>
              : r.unread
                ? <button type="button" onClick={() => read(r)} className={cx(row, tint, "cursor-pointer")}><span className="sr-only">{t.page.markRead}: </span>{body}</button>
                : <div className={cx(row, tint)}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** "Mark all read" for the bell panel and the page header. Hidden when nothing is unread. */
export function MarkAllReadButton({ lang, unread, className, onDone }: { lang: Locale; unread: number; className?: string; onDone?: () => void }) {
  const t = copy[lang].bell;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (unread === 0 && !failed) return null;
  return (
    <>
      <Button variant="ghost" size="sm" disabled={pending} className={className} onClick={() => start(async () => {
        const r = await markAllReadAction();
        setFailed(!r.ok);
        if (r.ok) onDone?.();
        router.refresh();
      })}>{t.markAll}</Button>
      {failed && <span role="alert" className="text-xs font-semibold text-danger-fg">{t.failed}</span>}
    </>
  );
}

/** The full list with "Load more" (cursor = id of the last row on screen). */
export default function NotificationFeed({ initial, hasMore, lang }: { initial: InboxRow[]; hasMore: boolean; lang: Locale }) {
  const t = copy[lang].page;
  const [extra, setExtra] = useState<{ rows: InboxRow[]; hasMore: boolean } | null>(null);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const seen = new Set(initial.map((r) => r.id));
  const rows = [...initial, ...(extra?.rows.filter((r) => !seen.has(r.id)) ?? [])];
  const more = extra ? extra.hasMore : hasMore;
  const last = rows.at(-1)?.id;
  return (
    <div className="grid gap-3">
      <NotificationList items={rows} lang={lang} />
      {more && last && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={pending} onClick={() => start(async () => {
            const r = await loadMoreAction(last, lang);
            setFailed(!r.ok);
            if (r.ok) setExtra({ rows: [...(extra?.rows ?? []), ...r.data.items], hasMore: r.data.hasMore });
          })}>{pending ? t.loading : t.loadMore}</Button>
          {failed && <span role="alert" className="text-sm font-semibold text-danger-fg">{copy[lang].bell.failed}</span>}
        </div>
      )}
    </div>
  );
}
