import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import Icon3D from "@/components/Icon3D";
import Avatar from "@/components/ui/Avatar";
import Sticker from "@/components/Sticker";
import Stage from "@/components/ops/Stage";
import Button from "@/components/ui/Button";
import { isLocale, tf, type Locale } from "@/i18n/config";
import { PERSONAS } from "@/lib/mockdb/seed";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { signInAs } from "@/lib/server/auth-actions";

// DEV SIGN-IN (mock auth). Replaced by Clerk <SignIn/> at this same URL (plan Task 5). Pick who you want to be.
const COPY = {
  mn: { title: "Хэн болж нэвтрэх вэ?", lead: "Clerk холбогдох хүртэл орон нутгийн демо. Хэн болж орохоо сонго: эрх, хуудас, мэдэгдэл бүгд тэр хүнийх шиг ажиллана.", cta: "Энэ хүн болж орох", pick: "Нэвтрэх хүн", as: "Нэвтрэх хүн", can: "Хийж чадах зүйл" },
  en: { title: "Who are you signing in as?", lead: "A local demo until Clerk is connected. Pick a person: permissions, pages and notifications all behave as they would for them.", cta: "Continue as this person", pick: "People to sign in as", as: "Signing in as", can: "What you can do" },
} as const;

// What each person can do, so the picker reads as "who am I signing in as" and not as a list of test accounts.
type Who = { role: Record<Locale, string>; lands: Record<Locale, string>; can: Record<Locale, string[]>; icon: string; wash: string };
const WHO: Record<string, Who> = {
  "dev-admin": {
    role: { mn: "Админ", en: "Admin" }, lands: { mn: "Админ самбар руу орно", en: "Opens the backoffice" }, icon: "shield", wash: "var(--ops-accent-soft)",
    can: { mn: ["Тохиргоо, үүрэг эрх удирдах", "Профайл нэгтгэх", "Эвент, гишүүдийг хянах"], en: ["Manage settings and roles", "Merge duplicate profiles", "Run events and review members"] },
  },
  "dev-organizer": {
    role: { mn: "Зохион байгуулагч", en: "Organizer" }, lands: { mn: "Админ самбар руу орно", en: "Opens the backoffice" }, icon: "clipboard", wash: "var(--ops-ok-soft)",
    can: { mn: ["Эвент үүсгэж нийтлэх", "Өргөдөл хянаж шийдвэр илгээх", "Гишүүдийн жагсаалт харах"], en: ["Create and publish events", "Review applications, send decisions", "See the member directory"] },
  },
  anuujin: {
    role: { mn: "Гишүүн", en: "Member" }, lands: { mn: "Миний Hackum руу орно", en: "Opens your member app" }, icon: "id", wash: "var(--ops-accent-soft)",
    can: { mn: ["Гишүүдийн эвентэд бүртгүүлэх", "Хакатонд багтай өргөдөл өгөх", "Тэмдэг цуглуулах"], en: ["RSVP, including members-only events", "Apply to hackathons with a team", "Collect badges"] },
  },
  temuulen: {
    role: { mn: "Зочин", en: "Guest" }, lands: { mn: "Миний Hackum руу орно", en: "Opens your member app" }, icon: "ticket", wash: "var(--ops-warn-soft)",
    can: { mn: ["Нээлттэй эвентэд бүртгүүлэх", "Гишүүнчлэлд өргөдөл өгөх", "Календарь холбох"], en: ["RSVP to open events", "Apply for membership", "Subscribe to your calendar"] },
  },
  saraa: {
    role: { mn: "Төгсөгч", en: "Alumni" }, lands: { mn: "Миний Hackum руу орно", en: "Opens your member app" }, icon: "grad-cap", wash: "var(--ops-ember-soft)",
    can: { mn: ["Төгсөгчдийн эвентэд оролцох", "Хуучин улирлуудаа харах", "Ментор тэмдэг авах"], en: ["Join alumni events", "See your past seasons", "Earn the mentor badge"] },
  },
  "new-guest": {
    role: { mn: "Шинэ хүн", en: "New here" }, lands: { mn: "Эхлээд танилцуулга бөглөнө", en: "Starts with onboarding" }, icon: "gift", wash: "var(--ops-ok-soft)",
    can: { mn: ["Нэр, сургуулиа бөглөх", "Анхны эвентээ сонгох", "Хэлээ тохируулах"], en: ["Add your name and school", "Pick your first event", "Choose your language"] },
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return { title: isLocale(lang) ? COPY[lang].title : "Sign in", robots: { index: false } };
}

async function Picker({ lang, searchParams }: { lang: Locale; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).next;
  const asked = typeof raw === "string" ? raw : null;
  const profiles = getStore().read().profiles;
  return (
    <ul aria-label={COPY[lang].pick} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PERSONAS.map((p) => {
        const who = WHO[p.handle] ?? WHO.anuujin;
        const me = profiles.find((x) => x.handle === p.handle);
        const person = (me && (tf(me.name, lang) || me.handle)) || p.label[lang];
        // Home is where the work is: staff open the backoffice, everyone else their member app (a requested page wins).
        const next = asked ?? (p.role === "admin" || p.role === "organizer" ? `/${lang}/admin` : `/${lang}/me`);
        return (
          <li key={p.handle}>
            <form action={signInAs} className="relative grid h-full content-between gap-4 overflow-hidden rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-card)]" style={{ background: `radial-gradient(120% 120% at 100% 0%, ${who.wash}, var(--ops-panel) 62%)` }}>
              <input type="hidden" name="handle" value={p.handle} />
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="next" value={next} />
              <Icon3D name={who.icon} sizes="96px" className="pointer-events-none absolute -top-1 -right-1 size-16 rotate-6 drop-shadow-[0_10px_12px_rgb(0_40_70/0.25)]" />
              <div className="flex items-center gap-3 pr-14">
                <Avatar name={person} src={me?.avatar_path} size={52} className="ring-2 ring-white" />
                <div className="grid min-w-0 gap-1">
                  <p className="text-xs font-semibold text-fg-muted">{COPY[lang].as}</p>
                  <h2 className="font-display text-lg leading-tight font-black text-fg [overflow-wrap:anywhere]">{p.label[lang]}</h2>
                  <p><span className="inline-flex rounded-full bg-panel px-2.5 py-0.5 text-xs font-bold text-accent-fg ring-1 ring-line">{who.role[lang]}</span></p>
                </div>
              </div>
              <div className="grid gap-2">
                <p className="text-sm font-bold text-fg">{COPY[lang].can}</p>
                <ul className="grid gap-1.5 text-sm text-fg-muted">
                  {who.can[lang].map((t) => <li key={t} className="flex items-start gap-2"><Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-ok-fg" />{t}</li>)}
                </ul>
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-fg-muted"><ArrowRight aria-hidden="true" size={14} />{who.lands[lang]}</p>
              </div>
              <Button type="submit" size="lg" className="min-h-12 w-full">{COPY[lang].cta}</Button>
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
