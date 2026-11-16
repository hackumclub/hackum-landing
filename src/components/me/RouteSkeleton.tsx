"use client";
import { useParams } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import { PageSkeleton } from "./parts";

/** Loading placeholder that knows the language from the URL, so a page whose params are dynamic (slug, id) can show it without awaiting them. */
export default function RouteSkeleton({ cards = 2 }: { cards?: number }) {
  const { lang } = useParams<{ lang: string }>();
  return <PageSkeleton label={copy[isLocale(lang) ? lang : "mn"].loading} cards={cards} />;
}
