"use client";
import Image from "next/image";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "@/motion/gsap";
import { Flip } from "@/motion/flip";
import { DUR, EASE, MQ } from "@/motion/config";
import type { Member } from "@/data/members";
import { fill, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import Split from "./motion/Split";

const season = (y: number) => `${y}–${String(y + 1).slice(2)}`;
const initials = (name: string) => name.replace(/^[A-ZА-ЯӨҮЁ]\.\s*/u, "").slice(0, 2).toUpperCase();
// Avatar backgrounds rotate through the three logo colours.
const AVATAR = ["bg-brand", "bg-leaf", "bg-sun text-ink"];

/**
 * Members directory: season tabs + search by name, team or role (search spans every season).
 * All cards stay in the DOM and filtered ones are hidden, so GSAP Flip can animate cards moving,
 * entering and leaving whenever the filter changes. Reduced motion: instant.
 */
export default function Members({ members, seasons, lang, dict, teams }: {
  members: Member[]; seasons: number[]; lang: Locale; dict: Dict["members"]; teams: Dict["about"]["teams"];
}) {
  const [q, setQ] = useState("");
  const [year, setYear] = useState<number | null>(seasons[0] ?? null);
  const grid = useRef<HTMLUListElement>(null);
  const flip = useRef<Flip.FlipState | null>(null);
  const query = q.trim().toLowerCase();

  const visible = useMemo(() => members.map((m) => {
    const team = m.team ? teams[m.team][0] : "";
    const inYear = query ? true : year === null || m.season === year;
    const hit = !query || [m.name.mn, m.name.en, team, dict.roles[m.role]].some((s) => s.toLowerCase().includes(query));
    return inYear && hit;
  }), [members, query, year, teams, dict.roles]);
  const count = visible.filter(Boolean).length;

  // Record positions before React re-renders the filter...
  const capture = () => {
    if (grid.current && window.matchMedia(MQ.motion).matches) flip.current = Flip.getState(grid.current.querySelectorAll("[data-member]"));
  };
  // ...then animate from them once the new filter is in the DOM.
  useLayoutEffect(() => {
    const state = flip.current;
    if (!state) return;
    flip.current = null;
    Flip.from(state, {
      duration: DUR.base, ease: EASE.ui, absoluteOnLeave: true, scale: true, nested: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: DUR.base, ease: EASE.ui }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: DUR.fast }),
    });
  }, [query, year]);

  const pill = (on: boolean) => `shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${on ? "bg-brand text-white shadow-glow" : "glass text-ink/70 hover:text-ink"}`;
  const pick = (y: number | null) => { capture(); setYear(y); setQ(""); };

  return (
    <section aria-labelledby="members" className="mt-24">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Split as="h2" id="members" className="font-display text-[clamp(30px,4vw,48px)] font-black leading-tight">{dict.title}</Split>
          <p className="mt-3 max-w-xl text-lg text-muted">{dict.lead}</p>
        </div>
        <label className="glass flex w-full max-w-sm items-center gap-3 rounded-full px-5 py-3 transition focus-within:ring-4 focus-within:ring-brand/25">
          <span className="sr-only">{dict.search}</span>
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-brand stroke-[2.2]"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={q} onChange={(e) => { capture(); setQ(e.target.value); }} type="search" placeholder={dict.search} aria-describedby="member-count"
            className="min-w-0 flex-1 bg-transparent font-semibold outline-none focus-visible:outline-none placeholder:font-normal placeholder:text-faint [&::-webkit-search-cancel-button]:hidden" />
          {q ? <button type="button" onClick={() => { capture(); setQ(""); }} aria-label={dict.clear} className="grid h-7 w-7 place-items-center rounded-full bg-ink/5 text-sm text-ink/60 hover:bg-ink hover:text-white">✕</button> : null}
        </label>
      </div>

      <div role="tablist" aria-label={dict.title} className="no-scrollbar -mx-6 mt-8 flex gap-2 overflow-x-auto px-6 pb-1">
        <button role="tab" type="button" aria-selected={!query && year === null} onClick={() => pick(null)} className={pill(!query && year === null)}>{dict.all}</button>
        {seasons.map((y) => (
          <button key={y} role="tab" type="button" aria-selected={!query && year === y} onClick={() => pick(y)} className={pill(!query && year === y)}>{season(y)}</button>
        ))}
      </div>
      <p id="member-count" aria-live="polite" className="mt-4 text-sm font-bold text-faint">{fill(dict.count, { n: count })}</p>

      {count === 0 ? <p className="glass mt-6 max-w-xl rounded-[22px] p-6 text-muted">{query ? dict.empty : dict.missing}</p> : null}
      <ul ref={grid} className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {members.map((m, i) => (
          <li key={`${m.season}-${m.name.en}`} data-member hidden={!visible[i]}
            className="group rounded-[22px] bg-paper p-5 shadow-soft ring-1 ring-ink/5 transition-shadow duration-300 hover:shadow-[0_18px_40px_-18px_rgb(0_91_140/0.45)]">
            <div className="flex items-start justify-between">
              {m.photo ? (
                <Image src={m.photo} alt="" width={72} height={72} sizes="72px" className="h-[72px] w-[72px] rounded-full object-cover ring-4 ring-brand-tint" />
              ) : (
                <span aria-hidden className={`grid h-[72px] w-[72px] place-items-center rounded-full font-display text-xl font-black text-white ring-4 ring-brand-tint transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105 ${AVATAR[i % AVATAR.length]}`}>{initials(m.name[lang])}</span>
              )}
              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-bold text-brand-deep">{season(m.season)}</span>
            </div>
            <p className="mt-4 font-display text-lg font-black leading-tight">{m.name[lang]}</p>
            <p className="mt-1 text-sm font-bold text-brand">{dict.roles[m.role]}</p>
            {m.team ? <p className="mt-0.5 text-sm text-muted">{teams[m.team][0]}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
