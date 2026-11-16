"use client";
import { useSyncExternalStore } from "react";
import { CalendarSync } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import { buttonClass } from "@/components/ui/Button";
import CopyButton from "./CopyButton";

const noSubscribe = () => () => {};

/** The person's private calendar feed: one webcal:// button for phones and an https link to copy (Google Calendar, Outlook). */
export default function CalendarFeed({ path, siteOrigin, c }: { path: string; /** Absolute site origin known on the server (SITE_URL): used for the first render so the link is valid without JavaScript. */ siteOrigin: string; c: MeCopy["settings"] }) {
  // After hydration the browser's own origin wins (correct for previews and local ports).
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => siteOrigin);
  const https = `${origin}${path}`;
  const webcal = `webcal://${origin.replace(/^https?:\/\//, "")}${path}`;
  return (
    <div className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <div className="grid gap-1">
        <h2 className="font-display text-lg font-bold text-fg">{c.calTitle}</h2>
        <p className="text-sm text-fg-muted">{c.calLine}</p>
      </div>
      <p className="rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2 text-sm break-all text-fg" data-testid="calendar-https">{https}</p>
      <div className="flex flex-wrap gap-2">
        <a href={webcal} className={buttonClass("primary", "lg")}><CalendarSync aria-hidden="true" size={16} />{c.calWebcal}</a>
        <CopyButton value={https} label={`${c.calHttps}: ${c.calCopy}`} copiedLabel={c.calCopied} />
      </div>
      <p className="text-sm text-fg-muted">{c.calPrivate}</p>
    </div>
  );
}
