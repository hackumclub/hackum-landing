"use client";
import { useParams } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import { PageSkeleton } from "@/components/me/parts";

export default function Loading() {
  const { lang } = useParams<{ lang: string }>();
  return <PageSkeleton label={copy[isLocale(lang) ? lang : "mn"].loading} />;
}
