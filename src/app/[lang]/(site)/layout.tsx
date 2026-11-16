import SiteChrome from "@/components/SiteChrome";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { notFound } from "next/navigation";

export default async function SiteLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <SiteChrome lang={lang} dict={getDictionary(lang)}>{children}</SiteChrome>;
}
