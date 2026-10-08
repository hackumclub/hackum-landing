import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nunito_Sans, Montserrat } from "next/font/google";
import "../globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Cursor from "@/components/Cursor";
import SmoothScroll from "@/components/motion/SmoothScroll";
import RouteSync from "@/components/motion/RouteSync";
import { getDictionary } from "@/i18n";
import { isLocale, LOCALES } from "@/i18n/config";
import { SITE_URL } from "@/lib/site-url";

const nunito = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin", "cyrillic"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin", "cyrillic"] });

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const d = getDictionary(lang).meta;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: d.title, template: `%s | ${d.title}` },
    description: d.description,
    alternates: { canonical: `/${lang}`, languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
    openGraph: { type: "website", siteName: d.title, title: d.title, description: d.description, locale: lang === "mn" ? "mn_MN" : "en_US" },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  return (
    <html lang={lang} className={`${nunito.variable} ${montserrat.variable} antialiased`}>
      <body className="bg-fur text-ink">
        <a href="#main" className="sr-only z-[95] rounded-full bg-brand px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">{dict.nav.skip}</a>
        {/* Fixed layers live outside the ScrollSmoother content (it is transformed). */}
        {/* Header and RouteSync read usePathname(); Next 16 requires a Suspense boundary for that on not-yet-known paths (the 404 catch-all). The page itself stays OUTSIDE any boundary so notFound() returns a real 404 status. */}
        <Suspense fallback={null}><Header lang={lang} nav={dict.nav} /><RouteSync /></Suspense>
        <Cursor />
        <SmoothScroll>
          <div className="flex min-h-screen flex-col overflow-x-clip pt-[72px]">
            <main id="main" className="flex-1">{children}</main>
            <Footer lang={lang} dict={dict} />
          </div>
        </SmoothScroll>
      </body>
    </html>
  );
}
