"use client";
import Link from "next/link";
import { forwardRef } from "react";
import { copy } from "@/i18n/areas/shell";
import type { Locale } from "@/i18n/config";
import Sticker from "@/components/Sticker";
import type { BellData } from "@/lib/notifications/load";
import { MarkAllReadButton, NotificationList } from "./NotificationList";

/** The popover body: latest rows, "Mark all read", "See all". Opening it never marks anything read. */
const NotificationPanel = forwardRef<HTMLDivElement, { id: string; lang: Locale; data: BellData; seeAllHref: string; onClose: () => void }>(
  function NotificationPanel({ id, lang, data, seeAllHref, onClose }, ref) {
    const t = copy[lang].bell;
    return (
      <div ref={ref} id={id} role="dialog" aria-label={t.panel} className="absolute inset-x-0 top-full z-40 mt-2 grid gap-2 rounded-[var(--radius-md)] border border-line bg-panel p-2 shadow-[var(--shadow-card)] md:inset-x-auto md:right-0 md:w-96">
        <div className="flex min-h-10 items-center justify-between gap-2 px-2">
          <h2 className="font-display text-base font-bold text-fg">{t.label}</h2>
          <MarkAllReadButton lang={lang} unread={data.unread} />
        </div>
        {data.items.length === 0 ? (
          <div className="grid justify-items-center gap-2 px-4 py-6 text-center">
            <Sticker name="sleepy" className="w-20" sizes="80px" />
            <p className="text-sm font-bold text-fg">{t.empty}</p>
            <p className="text-sm text-fg-muted">{t.emptyLine}</p>
          </div>
        ) : (
          <div className="max-h-[min(26rem,60dvh)] overflow-y-auto"><NotificationList items={data.items} lang={lang} onOpen={onClose} compact /></div>
        )}
        <Link href={seeAllHref} onClick={onClose} className="flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] text-sm font-bold text-accent-fg hover:bg-neutral-soft">{t.seeAll}</Link>
      </div>
    );
  },
);
export default NotificationPanel;
