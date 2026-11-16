import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { getDictionary } from "@/i18n";
import { fill, isLocale, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import ApplicationsQueue from "@/components/admin/members/ApplicationsQueue";
import { loadApplications } from "@/components/admin/members/data";
import { previewState } from "@/components/admin/members/preview";
import { SectionSkeleton } from "@/components/admin/members/shared";
import { requireStaffPage } from "@/lib/server/session";
import { formatUb } from "@/lib/time";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage();
  await connection();
  await previewState(searchParams);
  const c = copy[lang];
  const data = loadApplications();
  const w = data.window;
  const when = w.at ? formatUb(new Date(w.at), lang, { month: "short", day: "numeric" }) : "";
  const line = w.kind === "open" && w.label ? fill(c.members.applications.window.open, { label: tf(w.label, lang), when })
    : w.kind === "scheduled" && w.label ? fill(c.members.applications.window.scheduled, { label: tf(w.label, lang), when })
    : c.members.applications.window.closed;
  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 text-sm text-fg-muted"><Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{line}</p>
      <ApplicationsQueue data={data} lang={lang} c={c.members.applications} common={c.common} status={getDictionary(lang).status} />
    </div>
  );
}

export default async function ApplicationsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].members.applications.loading} rows={3} />}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
