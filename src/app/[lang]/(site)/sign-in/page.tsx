import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Icon3D from "@/components/Icon3D";
import Sticker from "@/components/Sticker";
import Stage from "@/components/ops/Stage";
import Button from "@/components/ui/Button";
import { isLocale, type Locale } from "@/i18n/config";
import { PERSONAS } from "@/lib/mockdb/seed";
import { mockEnabled } from "@/lib/mockdb/store";
import { signInAs } from "@/lib/server/auth-actions";

// DEV SIGN-IN (mock auth). Replaced by Clerk <SignIn/> at this same URL (plan Task 5). Pick who you want to be.
const COPY = {
  mn: { title: "Хэн болж нэвтрэх вэ?", lead: "Clerk холбогдох хүртэл орон нутгийн демо. Хэн болж орохоо сонго: эрх, хуудас, мэдэгдэл бүгд тэр хүнийх шиг ажиллана.", cta: "Энэ хүн болж орох", pick: "Нэвтрэх хүн" },
  en: { title: "Who are you signing in as?", lead: "A local demo until Clerk is connected. Pick a person: permissions, pages and notifications all behave as they would for them.", cta: "Continue as this person", pick: "People to sign in as" },
} as const;

const BLURB: Record<string, Record<Locale, string>> = {
  "dev-admin": { mn: "Бүх эрх: тохиргоо, үүрэг, профайл нэгтгэх", en: "Full access: settings, roles, merging profiles" },
  "dev-organizer": { mn: "Эвент, өргөдөл хянах, гишүүд", en: "Events, reviewing applications, members" },
  anuujin: { mn: "Гишүүн: өөрийн эвент, профайл, багууд", en: "Member: own events, profile, teams" },
  temuulen: { mn: "Зочин: RSVP хийж, гишүүнчлэлд өргөдөл өгнө", en: "Guest: can RSVP and apply for membership" },
  saraa: { mn: "Төгсөгч: хуучин гишүүн", en: "Alumna: a former member" },
  "new-guest": { mn: "Шинэ хүн: анхны тохиргоогоо хийнэ", en: "Brand new: goes through onboarding" },
};

// One 3D icon and one soft colour wash per persona.
const LOOK: Record<string, { icon: string; wash: string }> = {
  "dev-admin": { icon: "shield", wash: "var(--ops-accent-soft)" },
  "dev-organizer": { icon: "clipboard", wash: "var(--ops-ok-soft)" },
  anuujin: { icon: "id", wash: "var(--ops-accent-soft)" },
  temuulen: { icon: "ticket", wash: "var(--ops-warn-soft)" },
  saraa: { icon: "grad-cap", wash: "var(--ops-ember-soft)" },
  "new-guest": { icon: "gift", wash: "var(--ops-ok-soft)" },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? COPY[lang].title : "Sign in", robots: { index: false } };
}

async function Picker({ lang, searchParams }: { lang: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).next;
  const next = typeof raw === "string" ? raw : `/${lang}/me`;
  return (
    <ul aria-label={COPY[lang].pick} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PERSONAS.map((p) => {
        const look = LOOK[p.handle] ?? LOOK["anuujin"];
        return (
          <li key={p.handle}>
            <form action={signInAs} className="relative grid h-full content-between gap-5 overflow-hidden rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-card)]" style={{ background: `radial-gradient(120% 120% at 100% 0%, ${look.wash}, var(--ops-panel) 62%)` }}>
              <input type="hidden" name="handle" value={p.handle} />
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="next" value={next} />
              <Icon3D name={look.icon} sizes="96px" className="pointer-events-none absolute -top-1 -right-1 size-20 rotate-6 drop-shadow-[0_10px_12px_rgb(0_40_70/0.25)]" />
              <div className="pr-16">
                <h2 className="font-display text-xl font-black text-fg">{p.label[lang]}</h2>
                <p className="mt-1.5 text-sm text-fg-muted">{BLURB[p.handle]?.[lang]}</p>
              </div>
              <Button type="submit" size="lg" className="w-full">{COPY[lang].cta}</Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

export default async function SignInPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang } = await params;
  if (!isLocale(lang) || !mockEnabled()) notFound();
  return (
    // Light-only, like the rest of the public site: the ops tokens are scoped here and forced to light.
    <div className="ops ops-canvas mx-2 mt-2 mb-6 rounded-[40px] pb-10 md:mx-4" data-theme="light">
      <Stage
        title={COPY[lang].title}
        lead={COPY[lang].lead}
        art={
          <div className="relative size-20 md:h-64 md:w-[22rem]">
            <Sticker name="wave" eager sizes="176px" className="absolute top-0 right-0 w-20 -rotate-3 md:right-28 md:w-44" />
            <Sticker name="laptop" sizes="176px" className="absolute bottom-0 left-0 hidden w-40 rotate-6 md:block" />
            <Sticker name="coffee" sizes="144px" className="absolute right-0 bottom-2 hidden w-36 -rotate-6 md:block" />
          </div>
        }
        className="mx-2 md:mx-4"
      />
      <div className="mx-2 mt-6 md:mx-4">
        <Suspense fallback={<p className="text-fg-muted">…</p>}><Picker lang={lang} searchParams={searchParams} /></Suspense>
      </div>
    </div>
  );
}
