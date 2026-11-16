import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EVENTS } from "@/lib/events";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import EventSearch from "@/components/EventSearch";

export async function generateMetadata({ params }: PageProps<"/[lang]/events">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).meta.events } : {};
}

export default async function Page({ params }: PageProps<"/[lang]/events">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  return <EventSearch items={EVENTS} lang={lang} dict={d.events} ticket={d.ticket} />;
}
