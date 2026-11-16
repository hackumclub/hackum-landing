import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/shell";
import { copy as meCopy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import { loadInboxPage } from "@/lib/notifications/load";
import NotificationsPage from "@/components/notifications/NotificationsPage";
import { PageSkeleton } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].page.title } : {};
}

async function Body({ params }: Props) {
  const { lang, session } = await meContext(params, (l) => `/${l}/me/notifications`);
  return <NotificationsPage lang={lang} page={loadInboxPage(session.profileId, lang)} variant="me" />;
}

export default async function Page({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={meCopy[lang].loading} />}>
      <Body params={params} />
    </Suspense>
  );
}
