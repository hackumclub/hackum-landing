import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CLUB } from "@/lib/club";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import SubscribeForm from "@/components/SubscribeForm";
import Icon3D from "@/components/Icon3D";
import Split from "@/components/motion/Split";
import RevealGroup from "@/components/motion/RevealGroup";

const STEP_ICON = ["megaphone", "notebook", "trophy"];

export async function generateMetadata({ params }: PageProps<"/[lang]/join">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).meta.join } : {};
}

export default async function Page({ params }: PageProps<"/[lang]/join">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  const j = d.joinPage;
  return (
    <section className="mx-auto max-w-[1100px] px-6 pb-8 pt-12">
      {/* Plain top: title, one line of description, then name + email + send in a single row. */}
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold text-muted">{j.kicker}</p>
        <Split as="h1" mode="lines" hero className="mt-1 font-display text-[clamp(34px,5vw,56px)] font-black leading-none">{j.title}</Split>
        <p className="mt-3 max-w-xl text-lg text-muted">{d.subscribe.lead}</p>
        <div className="mt-6"><SubscribeForm lang={lang} dict={d.subscribe} /></div>
      </div>

      <RevealGroup as="ol" className="mt-20 grid gap-8 sm:grid-cols-3">
        {j.steps.map(([t, desc], i) => (
          <li key={t} className="group relative rounded-[26px] bg-paper p-7 shadow-soft ring-1 ring-ink/5 transition duration-300 hover:-translate-y-1 hover:shadow-card">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand font-display font-black text-white">{i + 1}</span>
            <Icon3D name={STEP_ICON[i]} sizes="112px" className="pointer-events-none absolute -right-5 -top-9 z-10 h-28 w-28 rotate-6 drop-shadow-[0_14px_18px_rgb(0_60_100/0.25)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
            <h2 className="mt-8 font-display text-xl font-black">{t}</h2>
            <p className="mt-2 text-muted">{desc}</p>
          </li>
        ))}
      </RevealGroup>

      <ul className="mt-10 flex flex-wrap justify-center gap-3">
        {CLUB.socials.map(([label, url]) => (
          <li key={label}><a href={url} target="_blank" rel="noopener noreferrer" className="btn-glass-light inline-block rounded-full px-6 py-3 font-bold text-ink hover:text-brand">{label}</a></li>
        ))}
      </ul>
    </section>
  );
}
