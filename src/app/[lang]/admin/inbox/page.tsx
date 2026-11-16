import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Skeleton from "@/components/ui/Skeleton";
import { copy, pageTitle } from "@/i18n/areas/shell";
import { isLocale, type Locale } from "@/i18n/config";
import { loadInboxPage } from "@/lib/notifications/load";
import { requireStaffPage } from "@/lib/server/session";
import NotificationsPage from "@/components/notifications/NotificationsPage";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: pageTitle(lang, "inbox") } : {};
}

async function Body({ lang }: { lang: Locale }) {
  const staff = await requireStaffPage({ lang, next: `/${lang}/admin/inbox` });
  await connection(); // relative times are per-request
  return <NotificationsPage lang={lang} page={loadInboxPage(staff.profileId, lang)} variant="admin" />;
}

export default async function InboxPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<div role="status" aria-label={copy[lang].page.loading} className="grid gap-4"><Skeleton className="h-28 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>}>
      <Body lang={lang} />
    </Suspense>
  );
}
