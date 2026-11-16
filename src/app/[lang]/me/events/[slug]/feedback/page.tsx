import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { fill, isLocale, tf } from "@/i18n/config";
import { feedbackAccess } from "@/lib/me/feedback-due";
import { formatUb } from "@/lib/time";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { feedbackCopy } from "@/components/me/feedback/copy";
import FeedbackForm from "@/components/me/feedback/FeedbackForm";
import FeedbackSummaryCard from "@/components/me/feedback/FeedbackSummaryCard";
import { PageHeader } from "@/components/me/parts";
import RouteSkeleton from "@/components/me/RouteSkeleton";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: feedbackCopy[lang].metaTitle } : {};
}

async function Body({ params }: Props) {
  const { slug } = await params;
  const { lang, session, db, now } = await meContext(params, (l) => `/${l}/me/events/${encodeURIComponent(slug)}/feedback`);
  const c = feedbackCopy[lang];
  const ev = db.events.find((e) => e.slug === slug && e.status !== "draft");
  // An unknown event and one this person cannot answer look the same: the ordinary not-found page.
  if (!ev) notFound();
  const access = feedbackAccess(db, ev, session.profileId, now);
  if (access.state === "none") notFound();

  const title = tf(ev.title, lang);
  const header = <PageHeader sticker="feedback" title={fill(c.headline, { title })} lead={fill(c.lead, { date: formatUb(new Date(ev.ends_at), lang, { year: "numeric", month: "long", day: "numeric" }) })} />;

  if (access.state === "closed") {
    return (
      <div className="grid gap-5">
        {header}
        <EmptyState sticker="sleepy" title={c.closedTitle} line={c.closedLine} action={<ButtonLink href={`/${lang}/me/events?tab=past`} size="lg">{c.back}</ButtonLink>} />
        {access.answer && <FeedbackSummaryCard answer={access.answer} c={c} />}
      </div>
    );
  }

  const a = access.answer;
  return (
    <div className="grid gap-5">
      {header}
      <FeedbackForm
        lang={lang} eventId={ev.id} c={c} closesText={formatUb(new Date(access.closesAt), lang, { month: "long", day: "numeric" })}
        initial={a ? { rating: a.rating, nps: a.nps, went_well: a.went_well, improve: a.improve, anonymous: a.anonymous } : null}
      />
    </div>
  );
}

/** Awaiting `params` (it carries the dynamic segment) must happen inside <Suspense>, so the guard lives in here. */
async function Guard(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return <Body {...props} />;
}

export default function FeedbackPage(props: Props) {
  return (
    <Suspense fallback={<RouteSkeleton cards={2} />}>
      <Guard {...props} />
    </Suspense>
  );
}
