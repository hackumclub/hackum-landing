import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { copy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import { safeNextPath } from "@/lib/me/queries";
import { meContext } from "@/components/me/context";
import OnboardingForm from "@/components/me/OnboardingForm";
import { PageSkeleton } from "@/components/me/parts";

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].onboarding.title } : {};
}

async function Body({ params, searchParams }: Props) {
  // Reachable while not onboarded (that is the point of the page); signed-out visitors still go to sign-in.
  const { lang, session, db, now, d, c } = await meContext(params, (l) => `/${l}/me/onboarding`, { onboarded: false });
  const raw = (await searchParams).next;
  const next = safeNextPath(typeof raw === "string" ? raw : undefined, lang);
  if (session.onboarded) redirect(next);
  const me = db.profiles.find((p) => p.id === session.profileId);
  const year = new Date(now.getTime() + 8 * 3_600_000).getUTCFullYear();
  return (
    <OnboardingForm
      lang={lang} c={c.onboarding} bilingual={d.ui.bilingual} next={next}
      initial={{ mn: me?.name.mn ?? "", en: me?.name.en ?? "", school: me?.school ?? "", gradYear: me?.grad_year ?? Math.min(2040, year + 2) }}
    />
  );
}

export default async function OnboardingPage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} cards={2} />}>
      <Body {...props} />
    </Suspense>
  );
}
