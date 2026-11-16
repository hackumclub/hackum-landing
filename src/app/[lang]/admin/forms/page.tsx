import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Icon3D from "@/components/Icon3D";
import Stage from "@/components/ops/Stage";
import FormsList from "@/components/admin/forms/FormsList";
import { FormsListSkeleton } from "@/components/admin/forms/Skeletons";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale, type Locale } from "@/i18n/config";
import { kindOrder } from "@/lib/forms/hub";
import { listForms } from "@/lib/mockdb/forms";
import { getStore } from "@/lib/mockdb/store";
import { requireStaffPage } from "@/lib/server/session";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "forms");

async function Body({ lang }: { lang: Locale }) {
  await requireStaffPage();
  await connection(); // response counts and dates are per request
  // Site forms first (membership, join), then one registration form per event, newest event first (listForms order).
  const rows = listForms(getStore().read()).sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
  return <FormsList rows={rows} lang={lang} />;
}

export default async function FormsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang].forms;
  return (
    <div className="grid grid-cols-1 gap-6">
      <Stage compact title={t.title} art={<Icon3D name="clipboard" sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-40" />} />
      <Suspense fallback={<FormsListSkeleton label={t.loading} />}>
        <Body lang={lang} />
      </Suspense>
    </div>
  );
}
