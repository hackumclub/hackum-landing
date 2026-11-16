import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import MembersDirectory from "@/components/admin/members/MembersDirectory";
import { loadDirectory } from "@/components/admin/members/data";
import { previewState } from "@/components/admin/members/preview";
import { SectionSkeleton } from "@/components/admin/members/shared";
import { requireStaffPage } from "@/lib/server/session";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage();
  await connection(); // "last seen" and counts are per-request
  await previewState(searchParams);
  const c = copy[lang];
  return <MembersDirectory data={loadDirectory()} lang={lang} c={c.members} common={c.common} status={getDictionary(lang).status} />;
}

export default async function MembersPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].members.loading} rows={8} />}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
