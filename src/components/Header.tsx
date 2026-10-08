"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { href, LOCALES, switchLocale, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import { INSTAGRAM } from "@/lib/club";
import Roll from "./motion/Roll";

const LINKS = [["/events", "events"], ["/about", "about"]] as const;

// Remember an explicit language choice so proxy.ts honours it on the next unprefixed visit.
function rememberLocale(l: Locale) {
  document.cookie = `lang=${l}; path=/; max-age=31536000; samesite=lax`;
}

/** Devfolio-style bar: logo | centred links | language + Instagram + Join. A glass pill that firms up once the page scrolls. */
export default function Header({ lang, nav }: { lang: Locale; nav: Dict["nav"] }) {
  const pathname = usePathname() ?? `/${lang}`;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // Language switch: the indicator slides to the chosen language first, then the route changes (the layout remounts per locale).
  const [pending, setPending] = useState<Locale | null>(null);
  const shown = pending ?? lang;

  const switchTo = (e: React.MouseEvent, l: Locale) => {
    rememberLocale(l);
    if (l === lang || pending || window.matchMedia("(prefers-reduced-motion: reduce)").matches || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    setPending(l);
    setTimeout(() => router.push(switchLocale(pathname, l)), 300);
  };

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const isActive = (p: string) => pathname.startsWith(href(lang, p));

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-2 pt-2 md:px-4">
      <nav aria-label={nav.menu} data-scrolled={scrolled || open ? "" : undefined} className="glass-bar relative mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-4 rounded-full px-3 pl-4">
        <Link href={href(lang)} className="flex items-center gap-2.5 font-display text-lg font-black tracking-tight text-ink" data-cursor-magnetic>
          {/* eslint-disable-next-line @next/next/no-img-element -- 128px brand mark */}
          <img src="/img/brand/logo-128.png" alt="" width={32} height={32} className="h-8 w-8" />
          Hackum
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map(([p, key]) => (
            <li key={p}>
              <Link href={href(lang, p)} aria-current={isActive(p) ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-[15px] font-semibold transition-colors ${isActive(p) ? "bg-white/85 text-brand-deep shadow-[inset_0_1px_0_#fff,0_4px_12px_-6px_rgb(0_91_140/0.45)]" : "text-ink/70 hover:bg-white/50 hover:text-ink"}`}>
                <Roll>{nav[key]}</Roll>
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <div role="group" aria-label={nav.language} className="relative flex rounded-full bg-white/40 p-1 text-xs font-bold ring-1 ring-white/70 shadow-[inset_0_1px_3px_rgb(0_60_100/0.14)]">
            <span aria-hidden className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_3px_8px_-3px_rgb(0_60_100/0.5)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ transform: `translateX(${LOCALES.indexOf(shown) * 100}%)` }} />
            {LOCALES.map((l) => (
              <Link key={l} href={switchLocale(pathname, l)} onClick={(e) => switchTo(e, l)} hrefLang={l} lang={l}
                aria-current={l === lang ? "true" : undefined}
                className={`relative z-10 w-9 py-1 text-center uppercase transition-colors duration-300 ${l === shown ? "text-brand-deep" : "text-ink/55 hover:text-ink"}`}>
                {l}
              </Link>
            ))}
          </div>
          <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" aria-label="Instagram @hackumclub"
            className="hidden h-9 w-9 place-items-center rounded-full bg-white/50 text-ink/70 ring-1 ring-white/70 transition hover:bg-white hover:text-brand sm:grid">
            <svg aria-hidden viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" className="fill-current" /></svg>
          </a>
          <Link href={href(lang, "/join")} className="btn-primary hidden rounded-full px-5 py-2.5 text-sm sm:inline-block">{nav.join}</Link>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="mobile-nav" aria-label={nav.menu}
            className="btn-primary grid h-10 w-10 place-items-center rounded-full md:hidden">
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">{open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 8h16M4 16h16" />}</svg>
          </button>
        </div>
      </nav>
      {open ? (
        <div id="mobile-nav" className="glass mx-auto mt-2 max-w-[1240px] rounded-[28px] p-3 md:hidden">
          <ul className="grid gap-1 text-lg font-bold">
            {[["", "home"], ...LINKS, ["/join", "join"]].map(([p, key]) => (
              <li key={key}><Link href={href(lang, p)} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 hover:bg-white/70">{nav[key as keyof typeof nav]}</Link></li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
