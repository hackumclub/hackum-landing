import Link from "next/link";
import { CLUB, LATEST_YEAR } from "@/lib/club";
import { fill, href, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";

const ICONS: Record<string, React.ReactNode> = {
  Instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></>,
  Facebook: <path d="M14 8h2.5V4.5H14A4 4 0 0 0 10 8.5V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V8.8c0-.5.2-.8.5-.8Z" />,
  Threads: <path d="M16.5 11.2c-.5-2.4-2.3-3.7-4.6-3.6-2.6.1-4.2 1.9-4.2 4.6 0 3 1.9 5 4.6 5 2 0 3.6-1.1 3.6-3 0-1.6-1.3-2.6-3.3-2.6-1.6 0-2.7.8-2.7 2 0 1 .8 1.6 1.9 1.6M19.5 7.5C18 4.8 15.3 3.5 12 3.5c-4.9 0-8.5 3.5-8.5 8.5s3.4 8.5 8.6 8.5c3.4 0 6-1.6 7.2-4.2" />,
};

/** Devfolio-inspired footer: big headline + socials on the left, link columns on the right, curved two-tone ground. */
export default function Footer({ lang, dict }: { lang: Locale; dict: Dict }) {
  const f = dict.footer;
  const club: [string, string][] = [[dict.nav.events, "/events"], [dict.nav.about, "/about"], [dict.nav.join, "/join"], [dict.meta.conduct, "/code-of-conduct"]];
  return (
    <footer className="relative mt-24 overflow-hidden">
      <svg aria-hidden viewBox="0 0 1440 600" preserveAspectRatio="none" className="absolute inset-0 -z-10 h-full w-full">
        <rect width="1440" height="600" fill="#ffffff" />
        <path d="M760 0C980 40 1060 200 1180 330 1290 450 1380 520 1440 540V600H0V560C260 560 420 470 520 330 640 160 600 20 760 0Z" fill="#e0f1fa" />
      </svg>
      <div className="mx-auto grid max-w-[1200px] gap-12 px-6 pb-12 pt-20 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="max-w-[16ch] font-display text-[clamp(32px,4vw,48px)] font-black leading-[1.05]">{f.headline}</p>
          <p className="mt-4 max-w-sm text-muted">{fill(f.about, { year: CLUB.founded })}</p>
          <ul className="mt-6 flex gap-2">
            {CLUB.socials.map(([label, url]) => (
              <li key={label}>
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label={label} data-cursor-magnetic
                  className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-soft ring-1 ring-ink/5 transition hover:-translate-y-0.5 hover:bg-brand hover:text-white">
                  <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">{ICONS[label]}</svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="mb-4 text-sm font-bold text-faint">{f.club}</h2>
            <ul className="space-y-3 font-semibold">
              {club.map(([label, p]) => <li key={p}><Link href={href(lang, p)} className="hover:text-brand">{label}</Link></li>)}
            </ul>
          </div>
          <div>
            <h2 className="mb-4 text-sm font-bold text-faint">{f.social}</h2>
            <ul className="space-y-3 font-semibold">
              {CLUB.socials.map(([label, url]) => <li key={label}><a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">{label}</a></li>)}
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-ink/10 px-6 py-8 text-sm text-muted">
        <span className="flex items-center gap-3 font-display text-lg font-black text-ink">
          {/* eslint-disable-next-line @next/next/no-img-element -- brand mark */}
          <img src="/img/brand/logo-128.png" alt="" width={36} height={36} className="h-9 w-9" />
          Hackum
        </span>
        <span>© {CLUB.founded}–{LATEST_YEAR} {CLUB.name}. {f.rights}</span>
      </div>
    </footer>
  );
}
