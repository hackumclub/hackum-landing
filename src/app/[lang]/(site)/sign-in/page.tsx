import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import DemoAccounts from "@/components/auth/DemoAccounts";
import SignInCard from "@/components/auth/SignInCard";
import SignOutForm from "@/components/auth/SignOutForm";
import { ButtonLink } from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { copy } from "@/i18n/areas/public";
import { isLocale, tf, type Locale } from "@/i18n/config";
import { landingPath, safeNext } from "@/lib/auth/landing";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { getSession } from "@/lib/server/session";

export async function generateMetadata({ params }: PageProps<"/[lang]/sign-in">): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? copy[lang].auth.signInTitle : "Sign in", robots: { index: false } };
}

/** Request-time half: `?next=`, `?error=` and who is already signed in. Everything else on the page is static. */
async function Body({ lang, searchParams }: { lang: Locale; searchParams: PageProps<"/[lang]/sign-in">["searchParams"] }) {
  const q = await searchParams;
  const next = safeNext(typeof q.next === "string" ? q.next : null);
  const c = copy[lang].auth;
  const session = await getSession();
  if (session) {
    const me = getStore().read().profiles.find((p) => p.id === session.profileId);
    const name = (me && tf(me.name, lang)) || session.handle;
    const chrome = copy[lang].chrome;
    return (
      <div className="grid gap-5 rounded-[28px] border border-line bg-panel p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="font-display text-[clamp(26px,4vw,34px)] leading-tight font-black text-fg [overflow-wrap:anywhere]">{chrome.signedInAs.replace("{name}", name)}</h1>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={landingPath(lang, next, { staff: !!session.staffRole, onboarded: session.onboarded })} size="lg">{session.staffRole ? chrome.dashboard : chrome.myHackum}</ButtonLink>
          <SignOutForm lang={lang} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-panel px-5 text-base font-bold text-fg hover:bg-panel-2">{chrome.signOut}</SignOutForm>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <SignInCard lang={lang} next={next} notice={q.error === "unknown" ? c.errors.unknownDemo : undefined} />
      <DemoAccounts lang={lang} next={next} />
    </div>
  );
}

function BodySkeleton() {
  return (
    <div aria-hidden className="grid gap-5 rounded-[28px] border border-line bg-panel p-6 sm:p-8">
      <Skeleton className="h-8 w-40" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
    </div>
  );
}

export default async function SignInPage({ params, searchParams }: PageProps<"/[lang]/sign-in">) {
  const { lang } = await params;
  if (!isLocale(lang) || !mockEnabled()) notFound();
  return (
    <AuthShell lang={lang}>
      <Suspense fallback={<BodySkeleton />}><Body lang={lang} searchParams={searchParams} /></Suspense>
    </AuthShell>
  );
}
