import Link from "next/link";
import { notFound } from "next/navigation";
import { CLUB, INSTAGRAM, TIMELINE, TIMELINE_MEDIA, WHO_PHOTOS } from "@/lib/club";
import { EVENTS } from "@/lib/events";
import { POSTERS } from "@/lib/posters";
import { IG_POSTS } from "@/lib/feed";
import type { StickerName } from "@/lib/manul";
import { fill, href, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import Lid, { type Placed } from "@/components/Lid";
import PhotoStack from "@/components/PhotoStack";
import Timeline from "@/components/Timeline";
import EventTicket from "@/components/EventTicket";
import PosterWall from "@/components/PosterWall";
import JoinSection from "@/components/JoinSection";
import Sticker from "@/components/Sticker";
import Split from "@/components/motion/Split";
import RotatingWords from "@/components/motion/RotatingWords";
import RevealGroup from "@/components/motion/RevealGroup";

// Hero sticker layout: two on phones (below the text), three from md up.
const LID: Placed[] = [
  { name: "wave", rotate: 8, className: "bottom-8 right-5 w-28 md:bottom-auto md:right-[7%] md:top-[11%] md:w-48" },
  { name: "laptop", rotate: -6, className: "bottom-10 left-5 w-32 md:left-auto md:bottom-[12%] md:right-[27%] md:w-52" },
  { name: "coffee", rotate: 12, className: "hidden md:block md:right-[3%] md:top-[50%] md:w-44" },
];
// "What we do" rows keep their original hover sticker, in the same order as dict.programs.items.
const PROGRAM_STICKER: StickerName[] = ["laptop", "torch", "smug", "coffee", "yell", "roll"];
const WALL = [POSTERS.meetup2, POSTERS.cv, POSTERS.quiz, POSTERS.git, POSTERS.typerace, POSTERS.tetris, POSTERS.trip, POSTERS.meetup3, POSTERS.kd05, POSTERS.meetupArch];
const TILT = [-1.5, 1, -0.5];
const plain = (s: string) => s.replace(/[[\]]/g, "");

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  const nums = { year: CLUB.founded };

  return (
    <>
      <Lid stickers={LID} className="mx-2 mt-2 rounded-[40px] bg-[radial-gradient(130%_100%_at_0%_0%,#13a3ea_0%,#0085ca_40%,#004a73_100%)] px-6 pb-64 pt-20 text-white md:mx-4 md:min-h-[min(92vh,860px)] md:pb-24 md:pt-28">
        <div className="pointer-events-none relative z-10 mx-auto max-w-[1200px]">
          <p className="overflow-hidden text-lg font-bold text-white/80"><span data-rise className="block">{d.hero.hello}</span></p>
          <h1 className="mt-5 max-w-[12ch] font-display text-[clamp(44px,7.6vw,108px)] font-black leading-[0.95] tracking-[-0.02em]">
            {d.hero.title.map((l) => <span key={l} className="block overflow-hidden pb-[0.06em]"><span data-rise className="block">{l}</span></span>)}
          </h1>
          <p className="mt-5 overflow-hidden font-display text-[clamp(22px,2.6vw,34px)] font-black"><span data-rise className="block">{d.hero.rotateLead} <RotatingWords words={d.hero.rotate} className="text-[#7fd3ff]" /></span></p>
          <p className="mt-6 max-w-md overflow-hidden text-lg text-white/85"><span data-rise className="block">{fill(d.hero.lead, nums)}</span></p>
          <div className="pointer-events-auto -mx-3 -mb-3 mt-6 overflow-hidden p-3">
            <span data-rise className="flex flex-wrap gap-3">
              <Link href={href(lang, "/join")} className="btn-white rounded-full px-7 py-3.5">{d.hero.join}</Link>
              <Link href={href(lang, "/events")} className="btn-glass rounded-full px-7 py-3.5">{d.hero.events}</Link>
            </span>
          </div>
        </div>
        <p className="absolute bottom-6 right-8 z-10 hidden text-sm text-white/60 md:block">{d.hero.drag}</p>
      </Lid>

      <section className="mx-auto max-w-[1200px] px-6 py-24 md:py-32">
        <Split mode="scrub" className="max-w-[22ch] font-display text-[clamp(30px,4.4vw,56px)] font-black leading-[1.08] tracking-[-0.01em]">{fill(d.who.facts, nums)}</Split>
        <div className="mt-16 grid items-center gap-16 md:grid-cols-[1fr_1.1fr]">
          <PhotoStack photos={WHO_PHOTOS.map((p) => ({ src: p.src, alt: p.alt[lang] }))} label={d.who.photoNext} className="mx-auto max-w-[480px]" />
          <div className="max-w-[60ch]">
            <Split as="h2" className="font-display text-3xl font-black">{d.who.title}</Split>
            <Split mode="fade" className="mt-4 text-lg leading-relaxed text-muted">{d.about.mission[0]}</Split>
            <blockquote className="mt-8 border-l-4 border-brand pl-5">
              <p className="font-display text-2xl font-black leading-snug">“{d.who.quote}”</p>
              <footer className="mt-2 text-sm text-faint">{d.who.quoteLabel}</footer>
            </blockquote>
            <Link href={href(lang, "/about")} className="mt-8 inline-block font-bold text-brand underline decoration-2 underline-offset-4 hover:decoration-4">{d.who.more}</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="memories" className="pb-24">
        <Timeline items={TIMELINE} media={TIMELINE_MEDIA} lang={lang} dict={d.timeline} joinHref={href(lang, "/join")} />
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Split as="h2" className="font-display text-[clamp(30px,4vw,48px)] font-black leading-tight">{d.latest.title}</Split>
          <Link href={href(lang, "/events")} className="font-bold text-brand underline decoration-2 underline-offset-4 hover:decoration-4">{d.latest.all}</Link>
        </div>
        <RevealGroup className="mt-6 grid gap-8 md:grid-cols-3">
          {EVENTS.slice(0, 3).map((e, i) => <EventTicket key={e.slug} e={e} lang={lang} dict={d.ticket} tilt={TILT[i]} />)}
        </RevealGroup>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 py-24">
        <Split as="h2" className="font-display text-[clamp(30px,4vw,48px)] font-black leading-tight">{d.programs.title}</Split>
        <p className="mt-3 max-w-xl text-lg text-muted">{d.programs.lead}</p>
        <ul className="mt-12 border-t-2 border-ink">
          {d.programs.items.map(([t, desc], i) => (
            <li key={t} className="group relative grid gap-2 border-b-2 border-ink/10 py-7 md:grid-cols-[1fr_1.2fr] md:items-center">
              <h3 className="font-display text-2xl font-black md:text-[32px]">{t}</h3>
              <p className="max-w-[48ch] text-muted md:pr-36">{desc}</p>
              <Sticker name={PROGRAM_STICKER[i % PROGRAM_STICKER.length]} sizes="112px" className="pointer-events-none absolute right-0 top-1/2 hidden w-28 -translate-y-1/2 rotate-6 scale-75 opacity-0 transition duration-300 group-hover:rotate-0 group-hover:scale-100 group-hover:opacity-100 md:block" />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="posters" className="pb-24">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-end justify-between gap-4 px-6">
          <div>
            <Split as="h2" id="posters" className="font-display text-[clamp(30px,4vw,48px)] font-black leading-tight">{d.posters.title}</Split>
            <p className="mt-3 max-w-lg text-lg text-muted">{d.posters.lead}</p>
          </div>
          <p className="hidden text-sm text-faint md:block">{d.posters.drag}</p>
        </div>
        <div className="mt-10"><PosterWall label={plain(d.posters.title)} posters={WALL.map((p) => ({ ...p, alt: lang === "en" ? p.altEn : p.alt }))} /></div>
      </section>

      <JoinSection lang={lang} dict={d.join} ig={d.instagram} igUrl={INSTAGRAM} posts={IG_POSTS} joinHref={href(lang, "/join")} />
    </>
  );
}
