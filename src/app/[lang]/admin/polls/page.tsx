import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { ButtonLink } from "@/components/ui/Button";
import PollsList from "@/components/admin/polls/PollsList";
import { PollsListSkeleton } from "@/components/admin/polls/Skeletons";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-polls";
import { href, isLocale, type Locale } from "@/i18n/config";
import { pollRows } from "@/lib/polls/rows";
import { getStore } from "@/lib/mockdb/store";
import { requireStaffPage } from "@/lib/server/session";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: { absolute: `${copy[lang].title} | ${getDictionary(lang).admin.title}` } } : {};
}

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage();
  await connection(); // phase and turnout are per request
  const sp = await searchParams;
  // ?state=empty|error previews each state in development; ignored in production.
  const scenario = process.env.NODE_ENV !== "production" && (sp.state === "empty" || sp.state === "error") ? sp.state : null;
  if (scenario === "error") throw new Error("polls_list_preview_error");
  const store = getStore();
  return <PollsList rows={scenario === "empty" ? [] : pollRows(store.read(), store.now())} lang={lang} />;
}

export default async function PollsPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = copy[lang];
  return (
    <div className="grid grid-cols-1 gap-6">
      <Stage
        compact title={t.title} lead={t.lead}
        actions={<ButtonLink href={href(lang, "/admin/polls/new")} icon={<Plus aria-hidden="true" size={16} />}>{t.newPoll}</ButtonLink>}
        art={<Icon3D name="clipboard" sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-44" />}
      />
      <Suspense fallback={<PollsListSkeleton label={t.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
