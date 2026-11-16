import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { lang as rootLang } from "next/root-params";
import { ArrowLeft } from "lucide-react";
import Icon3D from "@/components/Icon3D";
import Stage from "@/components/ops/Stage";
import EventQuestions from "@/components/admin/forms/EventQuestions";
import FormEditor from "@/components/admin/forms/FormEditor";
import ResponsesTable, { type ResponseRow } from "@/components/admin/forms/ResponsesTable";
import { FormDetailSkeleton } from "@/components/admin/forms/Skeletons";
import { ButtonLink } from "@/components/ui/Button";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import Tag from "@/components/ui/Tag";
import { copy } from "@/i18n/areas/admin-events";
import { fill, href, isLocale, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import { formHref, isSiteForm, parseFormId } from "@/lib/forms/hub";
import { formDefinition, listResponses, orphanKeys } from "@/lib/mockdb/forms";
import { getStore } from "@/lib/mockdb/store";
import { requireStaffPage } from "@/lib/server/session";
import { formatUb } from "@/lib/time";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "forms");

type Params = Promise<{ lang: string; id: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

async function Body({ lang, params, searchParams }: { lang: Locale; params: Params; searchParams: Search }) {
  const { id: raw } = await params;
  await requireStaffPage();
  await connection();
  const id = parseFormId(raw);
  const db = getStore().read();
  const def = id ? formDefinition(db, id) : null;
  if (!id || !def) notFound(); // unknown or malformed ids are the ordinary 404, never an empty editor
  const t = copy[lang].forms;
  const tab = (await searchParams).tab === "responses" ? "responses" : "questions";

  const found = listResponses(db, id) ?? [];
  const handles = new Map(db.profiles.map((p) => [p.id, p.handle]));
  const rows: ResponseRow[] = found.map((r) => ({ ...r, handle: handles.get(r.profile_id) ?? "" }));
  const orphans = orphanKeys(def.questions, found);
  const site = isSiteForm(id);
  const eventId = site ? null : id.slice(6);
  const kind = site ? id : "event_registration";
  const updatedAt = site ? db.forms.find((f) => f.id === id)?.updated_at : null;
  // Every key anybody ever answered under: a new question must never reuse one of them.
  const reserved = [...new Set(found.flatMap((r) => Object.keys(r.answers)))];
  const base = href(lang, formHref(id));

  return (
    <div className="grid grid-cols-1 gap-4">
      <Link href={href(lang, "/admin/forms")} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" size={16} />{t.detail.back}
      </Link>
      <Stage
        compact
        title={<span className="max-md:block max-md:pr-4">{tf(def.title, lang)}</span>}
        lead={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2 max-md:pr-6">
            <Tag>{t.kinds[kind]}</Tag>
            <span>{plural(lang, def.questions.length, t.questionsN)}</span>
            {updatedAt && <span>{fill(t.detail.updated, { when: formatUb(new Date(updatedAt), lang, { month: "short", day: "numeric", year: "numeric" }) })}</span>}
          </span>
        }
        art={<Icon3D name="clipboard" sizes="208px" className="w-24 rotate-3 drop-shadow-[0_18px_22px_rgb(0_30_60/0.45)] md:w-40" />}
      />
      <SegmentedTabs
        ariaLabel={t.detail.tabsLabel} value={tab}
        items={[{ key: "questions", label: t.detail.tabs.questions }, { key: "responses", label: t.detail.tabs.responses, count: rows.length }]}
        hrefs={{ questions: `${base}?tab=questions`, responses: `${base}?tab=responses` }}
      />
      {tab === "responses" ? (
        <ResponsesTable
          rows={rows} questions={def.questions} orphans={orphans} lang={lang} formId={id}
          emptyAction={<ButtonLink href={eventId ? href(lang, `/admin/events/${eventId}`) : `${base}?tab=questions`}>{eventId ? t.responses.empty.actionEvent : t.responses.empty.actionSite}</ButtonLink>}
        />
      ) : site ? (
        <FormEditor key={id} lang={lang} formId={id} initial={def.questions} answered={rows.length} reservedIds={reserved} />
      ) : (
        <EventQuestions lang={lang} eventId={eventId!} questions={def.questions} />
      )}
    </div>
  );
}

export default async function FormDetailPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  // `id` is request data, so params is only awaited inside Suspense; the locale is a root param and is known up front.
  const lang = await rootLang();
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<FormDetailSkeleton label={copy[lang].forms.detail.loading} />}>
      <Body lang={lang} params={params} searchParams={searchParams} />
    </Suspense>
  );
}
