import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import StaffManager from "@/components/admin/settings/StaffManager";
import { loadStaff } from "@/components/admin/settings/data";
import { previewState } from "@/components/admin/members/preview";
import { SectionSkeleton } from "@/components/admin/members/shared";
import { requireStaffPage } from "@/lib/server/session";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  const me = await requireStaffPage("admin");
  await connection();
  await previewState(searchParams);
  const c = copy[lang];
  return <StaffManager data={loadStaff(me.profileId)} lang={lang} c={c.settings.staff} common={c.common} />;
}

export default async function StaffPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].settings.loading} rows={4} />}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
