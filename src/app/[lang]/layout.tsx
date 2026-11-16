import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Nunito_Sans, Montserrat } from "next/font/google";
import "../globals.css";
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

/** Document shell only. Public chrome lives in (site)/layout.tsx; /admin and /me bring their own shells. */
export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang} className={`${nunito.variable} ${montserrat.variable} antialiased`}>
      <body className="bg-fur text-ink">{children}</body>
    </html>
  );
}
