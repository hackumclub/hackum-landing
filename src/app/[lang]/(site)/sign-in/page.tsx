import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Sticker from "@/components/Sticker";
import { isLocale, type Locale } from "@/i18n/config";
import { PERSONAS } from "@/lib/mockdb/seed";
import { mockEnabled } from "@/lib/mockdb/store";
import { signInAs } from "@/lib/server/auth-actions";

// DEV SIGN-IN (mock auth). Replaced by Clerk <SignIn/> at this same URL (plan Task 5). Pick who you want to be.
const COPY = {
  mn: { title: "Нэвтрэх (демо)", lead: "Clerk холбогдох хүртэл орон нутгийн демо. Хэн болж орохоо сонго. Эрх, хуудас, мэдэгдэл бүгд тэр хүнийх шиг ажиллана.", cta: "Энэ хүн болж орох" },
  en: { title: "Sign in (demo)", lead: "A local demo until Clerk is connected. Pick who to sign in as; permissions, pages and notifications all behave as that person.", cta: "Continue as this person" },
} as const;
const BLURB: Record<string, Record<Locale, string>> = {
  "dev-admin": { mn: "Бүх эрх: тохиргоо, үүрэг, профайл нэгтгэх", en: "Full access: settings, roles, merging profiles" },
  "dev-organizer": { mn: "Эвент, өргөдөл хянах, гишүүд", en: "Events, reviewing applications, members" },
  anuujin: { mn: "Гишүүн: өөрийн эвент, профайл, багууд", en: "Member: own events, profile, teams" },
  temuulen: { mn: "Зочин: RSVP хийж, гишүүнчлэлд өргөдөл өгнө", en: "Guest: can RSVP and apply for membership" },
  saraa: { mn: "Төгсөгч: хуучин гишүүн", en: "Alumna: a former member" },
  "new-guest": { mn: "Шинэ хүн: анхны тохиргоогоо хийнэ", en: "Brand new: goes through onboarding" },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? COPY[lang].title : "Sign in", robots: { index: false } };
}

async function Picker({ lang, searchParams }: { lang: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? raw : `/${lang}/me`;
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {PERSONAS.map((p) => (
        <li key={p.handle}>
          <form action={signInAs} className="grid h-full content-between gap-3 rounded-[20px] bg-white p-5 shadow-[var(--shadow-card)]">
            <input type="hidden" name="handle" value={p.handle} />
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="next" value={next} />
            <div>
              <p className="font-display text-lg font-bold text-ink">{p.label[lang]}</p>
              <p className="mt-1 text-sm text-muted">{BLURB[p.handle]?.[lang]}</p>
            </div>
            <button type="submit" className="btn-primary min-h-11 rounded-full px-5 py-2.5 text-sm">{COPY[lang].cta}</button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export default async function SignInPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang } = await params;
  if (!isLocale(lang) || !mockEnabled()) notFound();
  return (
    <section className="mx-auto max-w-3xl px-6 py-14">
      <Sticker name="wave" className="w-28" sizes="112px" />
      <h1 className="mt-4 font-display text-3xl font-black md:text-4xl">{COPY[lang].title}</h1>
      <p className="mt-3 max-w-xl text-muted">{COPY[lang].lead}</p>
      <Suspense fallback={<p className="mt-6 text-muted">…</p>}><Picker lang={lang} searchParams={searchParams} /></Suspense>
    </section>
  );
}
