// Server component: the language comes from the [lang] root param, so the 404 text is in the HTML itself
// (works without JavaScript and for crawlers). Motion lives in <NotFoundFx/>.
import Link from "next/link";
import { lang as rootLang } from "next/root-params";
import NotFoundFx from "@/components/motion/NotFoundFx";
import Sticker from "@/components/Sticker";
import Icon3D from "@/components/Icon3D";
import { DEFAULT_LOCALE, href, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

/** Localized 404: a glass card with the grumpy Manul, the missing puzzle piece and the coffee that wasn't found. */
export default async function NotFound() {
  const raw = await rootLang();
  const lang = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const d = getDictionary(lang);

  return (
    <section data-nf className="relative mx-auto flex min-h-[72vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <NotFoundFx />
      <title>{d.meta.notFound}</title>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(0_133_202/0.35),transparent_65%)] blur-2xl" />
      <div className="glass relative w-full rounded-[36px] px-6 pb-12 pt-24 md:px-16">
        <Icon3D data-bob name="puzzle" sizes="128px" className="pointer-events-none absolute -top-10 right-0 h-28 w-28 rotate-12 sm:-right-8 sm:h-32 sm:w-32 drop-shadow-[0_18px_22px_rgb(0_40_70/0.35)]" />
        <Icon3D data-bob name="coffee" sizes="128px" className="pointer-events-none absolute -bottom-10 left-0 h-28 w-28 -rotate-12 sm:-left-8 sm:h-32 sm:w-32 drop-shadow-[0_18px_22px_rgb(0_40_70/0.35)]" />
        <div data-bob className="absolute left-1/2 top-0 -ml-[72px] -mt-[72px] w-36">
          <Sticker name="grumpy" sizes="144px" className="w-full" />
        </div>
        <p data-in className="bg-gradient-to-br from-brand to-leaf bg-clip-text font-display text-[clamp(80px,16vw,144px)] font-black leading-none text-transparent">404</p>
        <h1 data-in className="mt-3 font-display text-3xl font-black md:text-4xl">{d.notFound.title}</h1>
        <p data-in className="mx-auto mt-3 max-w-md text-muted">{d.notFound.text}</p>
        <div data-in className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={href(lang)} className="btn-primary rounded-full px-7 py-3.5">{d.notFound.back}</Link>
          <Link href={href(lang, "/events")} className="btn-glass-light rounded-full px-7 py-3.5 font-bold text-brand-deep">{d.nav.events}</Link>
          <Link href={href(lang, "/join")} className="btn-glass-light rounded-full px-7 py-3.5 font-bold text-brand-deep">{d.nav.join}</Link>
        </div>
      </div>
    </section>
  );
}
