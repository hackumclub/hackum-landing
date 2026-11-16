import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { fill, isLocale, tf } from "@/i18n/config";
import { cardVm } from "@/lib/me/queries";
import { eventForViewer } from "@/lib/mockdb/queries";
import { formatUb } from "@/lib/time";
import { ButtonLink } from "@/components/ui/Button";
import Sticker from "@/components/Sticker";
import ApplyFlow from "@/components/me/ApplyFlow";
import ApplicationStatus from "@/components/me/ApplicationStatus";
import { PageSkeleton } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].apply.title } : {};
}

const CODE = /^[A-Za-z0-9-]{3,16}$/;

async function Body({ params, searchParams }: Props) {
  const { slug } = await params;
  const rawCode = (await searchParams).code;
  const prefill = typeof rawCode === "string" && CODE.test(rawCode) ? rawCode.toUpperCase() : null;
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me/events/${encodeURIComponent(slug)}/apply${prefill ? `?code=${prefill}` : ""}`);
  const a = c.apply;

  const ev = eventForViewer(db, slug, session.profileId);
  const me = db.profiles.find((p) => p.id === session.profileId);
  if (!ev || !me || ev.status === "draft") notFound();
  const vm = cardVm(db, ev, me, now);
  const title = tf(ev.title, lang);
  const deadline = ev.decision_deadline ? formatUb(new Date(ev.decision_deadline), lang, { month: "long", day: "numeric" }) : null;

  if (ev.reg_mode !== "application") {
    return (
      <div className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-10 text-center">
        <Sticker name="smug" className="w-24" sizes="96px" />
        <h1 className="font-display text-lg font-bold text-fg">{a.notApplication}</h1>
        <p className="max-w-sm text-sm text-fg-muted">{a.notApplicationLine}</p>
        <ButtonLink href={`/${lang}/events/${ev.slug}`} size="lg">{a.eventPage}</ButtonLink>
      </div>
    );
  }

  const myTeam = vm.reg?.teamId ? db.teams.find((t) => t.id === vm.reg?.teamId) ?? null : null;
  const status = vm.reg ? (
    <ApplicationStatus vm={vm} lang={lang} d={d} c={c} deadline={deadline} team={myTeam ? { id: myTeam.id, name: myTeam.name } : null} teamMax={ev.team_size_max} prefillCode={prefill} />
  ) : undefined;

  if (!vm.reg && !vm.elig.ok) {
    const r = vm.elig.reason;
    return (
      <div className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-10 text-center">
        <Lock aria-hidden="true" size={28} className="text-fg-muted" />
        <h1 className="font-display text-lg font-bold text-fg">{a.blocked[r]}</h1>
        <p className="max-w-sm text-sm text-fg-muted">{fill(a.blocked[`${r}Line`], { date: vm.elig.at ? formatUb(new Date(vm.elig.at), lang, { month: "long", day: "numeric" }) : "" })}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink href={`/${lang}/me/events`} size="lg">{c.nav.events}</ButtonLink>
          {r === "members" && <ButtonLink href={`/${lang}/me/membership`} size="lg" variant="secondary">{c.membership.title}</ButtonLink>}
        </div>
      </div>
    );
  }

  return (
    <ApplyFlow
      lang={lang} eventId={ev.id} slug={ev.slug} title={title} questions={ev.questions} teamMode={ev.team_mode}
      min={ev.team_size_min} max={ev.team_size_max} deadline={deadline} prefillCode={prefill} c={a} errorsCopy={c.errors}
      signInHref={`/${lang}/sign-in?next=${encodeURIComponent(`/${lang}/me/events/${ev.slug}/apply`)}`} statusSlot={status}
    />
  );
}

export default async function ApplyPage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} cards={2} />}>
      <Body {...props} />
    </Suspense>
  );
}
