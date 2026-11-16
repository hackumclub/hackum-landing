"use client";
import { useSyncExternalStore } from "react";
import { CalendarSync } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import { buttonClass } from "@/components/ui/Button";
import CopyButton from "./CopyButton";
import { IconCard } from "./parts";

const noSubscribe = () => () => {};

/** The person's private calendar feed: one webcal:// button for phones and an https link to copy (Google Calendar, Outlook). */
export default function CalendarFeed({ path, siteOrigin, c }: { path: string; /** Absolute site origin known on the server (SITE_URL): used for the first render so the link is valid without JavaScript. */ siteOrigin: string; c: MeCopy["settings"] }) {
  // After hydration the browser's own origin wins (correct for previews and local ports).
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => siteOrigin);
  const https = `${origin}${path}`;
  const webcal = `webcal://${origin.replace(/^https?:\/\//, "")}${path}`;
  return (
    <IconCard id="calendar" icon="link" tone="accent" title={c.calTitle} line={c.calLine}>
      <p className="rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2 text-sm break-all text-fg" data-testid="calendar-https">{https}</p>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <a href={webcal} className={buttonClass("primary", "lg", "w-full sm:w-auto")}><CalendarSync aria-hidden="true" size={16} />{c.calWebcal}</a>
        <CopyButton value={https} label={`${c.calHttps}: ${c.calCopy}`} copiedLabel={c.calCopied} className="w-full sm:w-auto" />
      </div>
      <p className="text-sm text-fg-muted">{c.calPrivate}</p>
    </IconCard>
  );
}
