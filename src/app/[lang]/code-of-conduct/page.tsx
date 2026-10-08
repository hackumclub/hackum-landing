import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Prose from "@/components/Prose";
import lines from "@/data/conduct.json";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/code-of-conduct">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: getDictionary(lang).meta.conduct } : {};
}

// The policy text itself is English-only for now; the Mongolian page says so above it.
export default async function Page({ params }: PageProps<"/[lang]/code-of-conduct">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = getDictionary(lang).conduct;
  return <Prose title={c.title} note={c.note} lines={lines} />;
}
