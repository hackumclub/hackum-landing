import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CLUB } from "@/lib/club";
import { MEMBERS, SEASONS, type Team } from "@/data/members";
import { STICKERS, type StickerName } from "@/lib/manul";
import { fill, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import Members from "@/components/Members";
import Icon3D from "@/components/Icon3D";
import Sticker from "@/components/Sticker";
import Split from "@/components/motion/Split";
import RevealGroup from "@/components/motion/RevealGroup";
import TiltCard from "@/components/motion/TiltCard";

const GOAL_ICON = ["chat", "heart", "rocket"];
const TEAM_ICON: Record<Team, string> = { project: "notebook", marketing: "megaphone", external: "trophy", internal: "calendar" };

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).meta.about } : {};
}

export default async function Page({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  const a = d.about;
  const nums = { year: CLUB.founded };

  return (
    <div className="mx-auto max-w-[1100px] px-6 pb-8 pt-14">
      <header className="grid items-end gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-lg font-bold text-brand">{a.kicker}</p>
          <Split as="h1" mode="lines" hero className="mt-2 font-display text-[clamp(44px,7vw,84px)] font-black leading-none">{a.title}</Split>
          <Split mode="fade" className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted">{fill(a.story, nums)}</Split>
        </div>
        <blockquote className="glass rounded-[26px] p-6">
          <p className="font-display text-2xl font-black leading-snug">“{d.who.quote}”</p>
          <footer className="mt-2 text-sm text-faint">{a.quoteLabel}</footer>
        </blockquote>
      </header>

      <section className="mt-20 grid gap-8 md:grid-cols-2">
        <article className="glass relative rounded-[26px] p-8">
          <Icon3D name="target" className="drop-shadow-[0_14px_18px_rgb(0_60_100/0.25)] pointer-events-none absolute -right-5 -top-9 z-10 h-28 w-28 -rotate-6" />
          <Split as="h2" className="font-display text-2xl font-black">{a.missionTitle}</Split>
          {a.mission.map((p) => <p key={p} className="mt-4 leading-relaxed text-muted">{p}</p>)}
        </article>
        <article className="glass relative rounded-[26px] p-8">
          <Icon3D name="bulb" className="drop-shadow-[0_14px_18px_rgb(0_60_100/0.25)] pointer-events-none absolute -right-5 -top-9 z-10 h-28 w-28 rotate-6" />
          <Split as="h2" className="font-display text-2xl font-black">{a.visionTitle}</Split>
          <p className="mt-4 leading-relaxed text-muted">{a.vision}</p>
        </article>
      </section>

      <section aria-labelledby="goals" className="mt-24">
        <Split as="h2" id="goals" className="font-display text-[clamp(30px,4vw,48px)] font-black leading-tight">{a.goalsTitle}</Split>
        <RevealGroup as="ol" className="mt-12 grid gap-8 md:grid-cols-3">
          {a.goals.map(([t, desc], i) => (
            <li key={t}><TiltCard className="h-full rounded-[26px]"><div className="group relative h-full rounded-[26px] bg-paper p-7 shadow-soft ring-1 ring-ink/5 transition-shadow duration-300 hover:shadow-card">
              <span className="font-display text-sm font-black text-brand">0{i + 1}</span>
              <Icon3D name={GOAL_ICON[i % GOAL_ICON.length]} className="drop-shadow-[0_14px_18px_rgb(0_60_100/0.25)] pointer-events-none absolute -right-5 -top-9 z-10 h-28 w-28 rotate-6 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
              <h3 className="mt-10 font-display text-xl font-black">{t}</h3>
              <p className="mt-2 text-muted">{desc}</p>
            </div></TiltCard></li>
          ))}
        </RevealGroup>
      </section>

      <section aria-labelledby="teams" className="mt-24">
        <Split as="h2" id="teams" className="font-display text-[clamp(30px,4vw,48px)] font-black leading-tight">{a.teamsTitle}</Split>
        <p className="mt-3 text-lg text-muted">{a.teamsLead}</p>
        <RevealGroup as="ul" className="mt-8 grid gap-4 sm:grid-cols-2">
          {(Object.keys(a.teams) as Team[]).map((k) => (
            <li key={k} className="glass flex items-start gap-5 rounded-[26px] p-6">
              <Icon3D name={TEAM_ICON[k]} className="drop-shadow-[0_14px_18px_rgb(0_60_100/0.25)] h-16 w-16 shrink-0" />
              <div>
                <h3 className="font-display text-lg font-black">{a.teams[k][0]}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{a.teams[k][1]}</p>
              </div>
            </li>
          ))}
        </RevealGroup>
      </section>

      <Members members={MEMBERS} seasons={SEASONS} lang={lang} dict={d.members} teams={a.teams} />

      <section className="mt-24 overflow-hidden rounded-[40px] bg-ink p-8 text-white md:p-12">
        <Split as="h2" className="font-display text-3xl font-black md:text-5xl">{a.mascotTitle}</Split>
        <p className="mt-4 max-w-xl text-lg text-white/75">{a.mascot}</p>
        <ul className="mt-10 grid grid-cols-3 gap-4 sm:grid-cols-5">
          {(Object.keys(STICKERS) as StickerName[]).map((n, i) => (
            <li key={n} className="grid place-items-center"><Sticker name={n} label={STICKERS[n].alt[lang]} sizes="140px" className={`w-full max-w-[140px] transition-transform duration-300 hover:scale-110 ${i % 2 ? "rotate-3" : "-rotate-3"}`} /></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
