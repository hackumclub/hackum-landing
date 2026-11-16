import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { ArrowLeft } from "lucide-react";
import Stage from "@/components/ops/Stage";
import Icon3D from "@/components/Icon3D";
import { getDictionary } from "@/i18n";
import { href, isLocale, type Locale } from "@/i18n/config";
import { parseComposeParams } from "@/lib/announce/compose-state";
import { copy } from "@/lib/announce/copy";
import { getStore } from "@/lib/mockdb/store";
import { DAILY_LIMIT, RESERVED_FOR_TRANSACTIONAL } from "@/lib/mockdb/outbox";
import { requireStaffPage } from "@/lib/server/session";
import Composer, { FormSkeleton } from "@/components/admin/comms/compose/Composer";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">) {
  const { lang } = await params;
  return isLocale(lang) ? { title: { absolute: `${copy[lang].metaTitle} | ${getDictionary(lang).admin.title}` } } : {};
}

async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  await requireStaffPage(); // staff and organizers; everyone else gets the ordinary 404
  await connection();
  const events = getStore().read().events
    .map((e) => ({ id: e.id, title: e.title, startsAt: e.starts_at }))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt)); // newest first
  const initialAudience = parseComposeParams(await searchParams, events.map((e) => e.id));
  return <Composer lang={lang} events={events} initialAudience={initialAudience} plan={{ perDay: DAILY_LIMIT - RESERVED_FOR_TRANSACTIONAL, reserved: RESERVED_FOR_TRANSACTIONAL }} />;
}

export default async function NewAnnouncementPage({ searchParams }: Pick<Props, "searchParams">) {
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  const t = copy[lang];
  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href={href(lang, "/admin/comms")} className="inline-flex min-h-8 w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" size={16} />{t.back}
      </Link>
      <Stage compact title={<span className="max-sm:text-[1.6rem]">{t.title}</span>} lead={t.lead} art={<Icon3D name="megaphone" sizes="208px" className="w-24 -rotate-6 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-40" />} />
      <Suspense fallback={<FormSkeleton label={t.preview.loading} />}>
        <Body lang={lang} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
