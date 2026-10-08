"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "@/motion/gsap";
import { Flip } from "@/motion/flip";
import { DUR, EASE, MQ } from "@/motion/config";
import Split from "./motion/Split";
import EventTicket from "./EventTicket";
import Sticker from "./Sticker";
import type { Event } from "@/lib/events";
import { fill, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";

const TILT = [-1.2, 0.8, -0.4, 1.1];

/**
 * Events list with a glass search: icon, animated example placeholder, "/" shortcut, clear button,
 * type and year chips, live result count. Filtering is instant and client-side.
 */
export default function EventSearch({ items, lang, dict, ticket }: { items: Event[]; lang: Locale; dict: Dict["events"]; ticket: Dict["ticket"] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [example, setExample] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const flip = useRef<Flip.FlipState | null>(null);

  const kinds = useMemo(() => [...new Set(items.flatMap((e) => e.themes))], [items]);
  const years = useMemo(() => [...new Set(items.map((e) => e.year))].sort().reverse(), [items]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.map((e) =>
      (!kind || e.themes.includes(kind)) && (!year || e.year === year) &&
      (!n || [e.name.mn, e.name.en, e.tagline.mn, e.tagline.en, e.year, ...e.themes.map((x) => ticket.kinds[x] ?? x)].some((s) => s.toLowerCase().includes(n))));
  }, [items, q, kind, year, ticket.kinds]);

  // "/" focuses the search from anywhere (unless already typing); Esc clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA)$/.test(t.tagName)) { e.preventDefault(); input.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cycle example queries in the placeholder while the field is empty.
  useEffect(() => {
    if (q) return;
    const id = setInterval(() => setExample((i) => (i + 1) % dict.examples.length), 2200);
    return () => clearInterval(id);
  }, [q, dict.examples.length]);

  const count = shown.filter(Boolean).length;

  // Flip: capture ticket positions before a filter change, animate to the new layout after it renders.
  const capture = () => {
    if (grid.current && window.matchMedia(MQ.motion).matches) flip.current = Flip.getState(grid.current.querySelectorAll("[data-ticket]"));
  };
  useLayoutEffect(() => {
    const state = flip.current;
    if (!state) return;
    flip.current = null;
    Flip.from(state, {
      duration: DUR.base, ease: EASE.ui, absoluteOnLeave: true, nested: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: DUR.base, ease: EASE.ui, stagger: 0.04 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, y: -12, duration: DUR.fast }),
    });
  }, [shown]);

  const chip = (on: boolean) => `rounded-full px-4 py-2 text-sm font-bold transition ${on ? "bg-brand text-white shadow-glow" : "glass text-ink/75 hover:text-ink"}`;
  const reset = () => { capture(); setQ(""); setKind(null); setYear(null); input.current?.focus(); };

  return (
    <div className="pb-16">
      <header className="relative mx-auto max-w-[1200px] px-6 pt-14">
        <Split as="h1" mode="lines" hero className="font-display text-[clamp(40px,6vw,72px)] font-black leading-none">{dict.title}</Split>
        <p className="mt-4 max-w-xl text-lg text-muted">{dict.lead}</p>

        <div className="relative mt-10 max-w-2xl">
          <div aria-hidden className="absolute -inset-3 -z-10 rounded-[30px] bg-[radial-gradient(60%_80%_at_20%_50%,rgb(0_133_202/0.25),transparent),radial-gradient(50%_80%_at_80%_50%,rgb(0_171_132/0.2),transparent)] blur-xl" />
          <label className="glass group flex items-center gap-3 rounded-[22px] px-5 py-4 transition-all duration-300 focus-within:scale-[1.01] focus-within:ring-4 focus-within:ring-brand/25">
            <span className="sr-only">{dict.search}</span>
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-none stroke-brand stroke-[2.2] transition-transform duration-300 group-focus-within:rotate-[-12deg] group-focus-within:scale-110"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={input} value={q} onChange={(e) => { capture(); setQ(e.target.value); }} type="search" enterKeyHint="search"
              placeholder={`${dict.placeholderPrefix}${dict.examples[example]}`} aria-describedby="event-count"
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none focus-visible:outline-none placeholder:font-normal placeholder:text-faint [&::-webkit-search-cancel-button]:hidden" />
            {q ? (
              <button type="button" onClick={() => { capture(); setQ(""); input.current?.focus(); }} aria-label={dict.clear}
                className="grid h-8 w-8 place-items-center rounded-full bg-ink/5 text-ink/60 transition hover:bg-ink hover:text-white">✕</button>
            ) : (
              <kbd title={dict.shortcut} className="hidden rounded-md border border-ink/15 bg-white/70 px-2 py-0.5 font-mono text-xs text-faint sm:inline">/</kbd>
            )}
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label={dict.type}>
          <button type="button" aria-pressed={!kind} onClick={() => { capture(); setKind(null); }} className={chip(!kind)}>{dict.all}</button>
          {kinds.map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { capture(); setKind(kind === k ? null : k); }} className={chip(kind === k)}>{ticket.kinds[k] ?? k}</button>)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={dict.year}>
          {years.map((y) => <button key={y} type="button" aria-pressed={year === y} onClick={() => { capture(); setYear(year === y ? null : y); }} className={chip(year === y)}>{y}</button>)}
        </div>
        <p id="event-count" aria-live="polite" className="mt-5 text-sm font-bold text-faint">{fill(dict.results, { n: count })}</p>
        <Sticker name="toast" sizes="144px" className="absolute right-6 top-8 hidden w-36 rotate-6 lg:block" />
      </header>

      {count === 0 ? (
        <div className="mx-auto mt-12 flex max-w-[1200px] flex-col items-start gap-4 px-6">
          <Sticker name="grumpy" sizes="112px" className="w-28" />
          <p className="max-w-lg text-lg">{fill(dict.empty, { q: q || year || "" })}</p>
          <button type="button" onClick={reset} className="rounded-full bg-brand px-6 py-3 font-bold text-white">{dict.reset}</button>
        </div>
      ) : null}
      <div ref={grid} className="relative mx-auto mt-4 grid max-w-[1200px] gap-x-8 gap-y-6 px-6 md:grid-cols-2">
        {items.map((e, i) => (
          <div key={e.slug} data-ticket hidden={!shown[i]}>
            <EventTicket e={e} lang={lang} dict={ticket} tilt={TILT[i % TILT.length]} />
          </div>
        ))}
      </div>
    </div>
  );
}
