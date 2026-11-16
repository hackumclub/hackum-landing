"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, UserRound } from "lucide-react";
import { initials } from "@/components/ui/Avatar";

type Labels = { menu: string; signedInAs: string; myHackum: string; dashboard: string; signOut: string };

/**
 * Avatar button + popup on the public bar. A disclosure (button with aria-expanded), not an ARIA menu: the items are
 * ordinary links and one form button, so Tab walks them. Escape or a click outside closes it and returns focus.
 */
export default function AccountMenu({ name, avatar, staff, labels, mineHref, dashHref, signOut }: { name: string; avatar: string | null; staff: boolean; labels: Labels; mineHref: string; dashHref: string; signOut: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const item = "flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-brand-tint";
  return (
    <div ref={root} className="relative hidden items-center gap-2 md:flex">
      {/* F-01: one visible click back to /me from every public page (the menu repeats it for narrower bars). */}
      <Link href={mineHref} className="btn-primary hidden rounded-full px-5 py-2.5 text-sm lg:inline-block">{labels.myHackum}</Link>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}
        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-white/50 py-1 pr-2.5 pl-1 ring-1 ring-white/70 transition hover:bg-white">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- small re-encoded photo served by /api/avatar
          <img src={avatar} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-brand-dark text-xs font-black text-white">{initials(name)}</span>
        )}
        <span className="sr-only">{labels.menu}: {name}</span>
        <ChevronDown aria-hidden size={16} className={`text-ink/70 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={panelId} role="group" aria-label={labels.menu} className="absolute top-full right-0 z-50 mt-2 grid w-64 gap-1 rounded-2xl bg-white p-2 shadow-card ring-1 ring-ink/10">
          <p className="truncate px-3 py-2 text-sm text-muted">{labels.signedInAs}</p>
          <Link href={mineHref} onClick={() => setOpen(false)} className={item}><UserRound aria-hidden size={18} className="text-brand-dark" />{labels.myHackum}</Link>
          {staff && <Link href={dashHref} onClick={() => setOpen(false)} className={item}><LayoutDashboard aria-hidden size={18} className="text-brand-dark" />{labels.dashboard}</Link>}
          {signOut}
        </div>
      )}
    </div>
  );
}
