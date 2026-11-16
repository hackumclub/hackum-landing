import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import EmptyState from "@/components/ui/EmptyState";
import MergePanel from "@/components/admin/members/MergePanel";
import { loadMerge } from "@/components/admin/members/data";
import { previewState } from "@/components/admin/members/preview";
import { SectionSkeleton } from "@/components/admin/members/shared";
import { requireStaffPage } from "@/lib/server/session";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  const session = await requireStaffPage();
  await connection();
  await previewState(searchParams);
  const c = copy[lang];
  // Organizers can read the Members area but not merge; the tab is disabled for them, and a direct visit explains why.
  if (session.staffRole !== "admin") return <EmptyState sticker="lock" title={c.members.merge.adminOnlyTitle} line={c.members.merge.adminOnlyLine} />;
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="max-w-2xl text-sm text-fg-muted">{c.members.merge.lead}</p>
      </div>
      <MergePanel data={loadMerge()} lang={lang} c={c.members.merge} common={c.common} status={getDictionary(lang).status} />
    </div>
  );
}

export default async function MergePage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].members.merge.loading} rows={4} />}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
