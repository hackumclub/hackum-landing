import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isLocale, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import IntegrationCards, { INTEGRATION_ENV } from "@/components/admin/settings/IntegrationCards";
import ResetDemo from "@/components/admin/settings/ResetDemo";
import { previewState } from "@/components/admin/members/preview";
import { SectionSkeleton } from "@/components/admin/members/shared";
import { requireStaffPage } from "@/lib/server/session";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "integrations");

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage("admin");
  await connection();
  await previewState(searchParams);
  const c = copy[lang];
  // Names and a set/not-set flag only; the values of these variables are never read into the page.
  const envSet = Object.fromEntries([...new Set(Object.values(INTEGRATION_ENV).flat())].map((name) => [name, !!process.env[name]]));
  return (
    <div className="grid gap-6">
      <IntegrationCards c={c.settings.integrations} envSet={envSet} />
      <ResetDemo c={c.settings.integrations.reset} common={c.common} />
    </div>
  );
}

export default async function IntegrationsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].settings.loading} rows={4} />}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
