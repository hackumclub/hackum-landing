import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import PollEditor from "@/components/admin/polls/PollEditor";
import { PollBodySkeleton } from "@/components/admin/polls/Skeletons";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-polls";
import { href, isLocale, type Locale } from "@/i18n/config";
import { emptyDraft } from "@/lib/polls/form";
import { audienceCounts } from "@/lib/polls/rows";
import { getStore } from "@/lib/mockdb/store";
import { requireStaffPage } from "@/lib/server/session";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: { absolute: `${copy[lang].editor.newTitle} | ${getDictionary(lang).admin.title}` } } : {};
}

async function Body({ lang }: { lang: Locale }) {
  await requireStaffPage();
  await connection(); // the audience counts are per request
  return <PollEditor lang={lang} initial={emptyDraft()} counts={audienceCounts(getStore().read())} voters={0} />;
}

export default async function NewPollPage({ params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang];
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href={href(lang, "/admin/polls")} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" size={16} />{t.back}
      </Link>
      <Stage compact title={t.editor.newTitle} art={<Icon3D name="clipboard" sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-44" />} />
      <Suspense fallback={<PollBodySkeleton label={t.loading} />}>
        <Body lang={lang} />
      </Suspense>
    </div>
  );
}
