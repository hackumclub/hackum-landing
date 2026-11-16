"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import { buttonClass } from "@/components/ui/Button";
import Sticker from "@/components/Sticker";

/** A team or event the person can't see looks exactly like one that doesn't exist. */
export default function MeNotFound() {
  const { lang } = useParams<{ lang: string }>();
  const l = isLocale(lang) ? lang : "mn";
  const t = copy[l].errors;
  return (
    <div className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-12 text-center">
      <Sticker name="search" className="w-24" sizes="96px" />
      <h1 className="font-display text-lg font-bold text-fg">{t.notFoundTitle}</h1>
      <p className="max-w-md text-sm text-fg-muted">{t.notFoundLine}</p>
      <Link href={`/${l}/me`} className={buttonClass("primary", "lg")}>{t.home}</Link>
    </div>
  );
}
