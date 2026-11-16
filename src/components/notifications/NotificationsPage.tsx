import type { ReactNode } from "react";
import Stage from "@/components/ops/Stage";
import Sticker from "@/components/Sticker";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { copy } from "@/i18n/areas/shell";
import { fill, type Locale } from "@/i18n/config";
import type { InboxPage } from "@/lib/notifications/load";
import NotificationFeed, { MarkAllReadButton } from "./NotificationList";

/** Shared body of /me/notifications and /admin/inbox: Stage header, unread count + "Mark all read", the list, or the empty state. */
export default function NotificationsPage({ lang, page, variant, children }: { lang: Locale; page: InboxPage; variant: "me" | "admin"; children?: ReactNode }) {
  const t = copy[lang].page;
  const staff = variant === "admin";
  return (
    <div className="grid gap-5">
      <Stage compact title={staff ? t.staffTitle : t.title} lead={staff ? t.staffLead : t.lead} art={<Sticker name="wave" sizes="176px" className="w-[4.25rem] -rotate-3 md:w-40" />} />
      {page.items.length === 0 ? (
        <EmptyState
          sticker="sleepy" title={t.emptyTitle} line={staff ? t.staffEmptyLine : t.emptyLine}
          action={<ButtonLink href={staff ? `/${lang}/admin` : `/${lang}/me/events`}>{staff ? t.staffEmptyAction : t.emptyAction}</ButtonLink>}
        />
      ) : (
        <>
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-fg-muted" aria-live="polite">{fill(copy[lang].bell.countChanged, { n: page.unread })}</p>
            <MarkAllReadButton lang={lang} unread={page.unread} />
          </div>
          <NotificationFeed initial={page.items} hasMore={page.hasMore} lang={lang} />
        </>
      )}
      {children}
    </div>
  );
}
