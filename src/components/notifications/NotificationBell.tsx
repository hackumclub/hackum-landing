"use client";
import { useEffect, useId, useRef, useState } from "react";
import { icons } from "@/components/ui/icons";
import CountBadge from "@/components/ui/CountBadge";
import { copy } from "@/i18n/areas/shell";
import { fill, type Locale } from "@/i18n/config";
import type { BellData } from "@/lib/notifications/load";
import NotificationPanel from "./NotificationPanel";

/**
 * Bell with an unread CountBadge and a popover of the latest items. The button's name includes the count; a polite live
 * region announces count changes (no sound). Esc and outside click close the panel; Esc returns focus to the bell.
 */
export default function NotificationBell({ lang, data, seeAllHref, size = "md" }: { lang: Locale; data: BellData; seeAllHref: string; size?: "md" | "lg" }) {
  const t = copy[lang].bell;
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // Announce only when the count changes after first render (derived-state pattern: no effect needed).
  const [seen, setSeen] = useState(data.unread);
  const [announce, setAnnounce] = useState("");
  if (seen !== data.unread) { setSeen(data.unread); setAnnounce(fill(t.countChanged, { n: data.unread })); }

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [open]);

  const name = data.unread > 0 ? fill(t.labelUnread, { n: data.unread }) : t.label;
  return (
    // Below 768px the panel spans the (positioned) top bar; from 768px it hangs under the bell.
    <div ref={wrap} className="md:relative">
      <button
        ref={button} type="button" aria-label={name} aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`relative grid cursor-pointer place-items-center rounded-full bg-seg-track text-fg-muted transition-colors duration-150 hover:bg-neutral-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ops-accent)] ${size === "lg" ? "size-11" : "size-10"}`}
      >
        <icons.bell aria-hidden="true" size={20} />
        {data.unread > 0 && <CountBadge n={data.unread} className="absolute -top-0.5 -right-0.5 bg-accent! text-on-accent!" />}
      </button>
      <span aria-live="polite" role="status" className="sr-only">{announce}</span>
      {open && <NotificationPanel id={panelId} lang={lang} data={data} seeAllHref={seeAllHref} onClose={() => setOpen(false)} />}
    </div>
  );
}
