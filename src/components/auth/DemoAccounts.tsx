import { ArrowRight, Check } from "lucide-react";
import Icon3D from "@/components/Icon3D";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { copy } from "@/i18n/areas/public";
import { tf, type Locale } from "@/i18n/config";
import { PERSONAS } from "@/lib/mockdb/seed";
import { getStore } from "@/lib/mockdb/store";
import { signInAs } from "@/lib/server/auth-actions";

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
  bayar: {
    role: { mn: "Зочин · МУИС", en: "Guest · NUM" }, lands: { mn: "Миний Hackum руу орно", en: "Opens your member app" }, icon: "ticket", wash: "var(--ops-ok-soft)",
    can: { mn: ["Гишүүнчлэлд өргөдөл өгөх (МУИС)", "МУИС-ийн эвентэд бүртгүүлэх", "Хакатонд багтай өргөдөл өгөх"], en: ["Apply for membership (NUM student)", "RSVP to NUM-only events", "Apply to hackathons with a team"] },
  },
  "new-guest": {
    role: { mn: "Шинэ хүн", en: "New here" }, lands: { mn: "Эхлээд танилцуулга бөглөнө", en: "Starts with onboarding" }, icon: "gift", wash: "var(--ops-ok-soft)",
    can: { mn: ["Нэр, сургуулиа бөглөх", "Анхны эвентээ сонгох", "Хэлээ тохируулах"], en: ["Add your name and school", "Pick your first event", "Choose your language"] },
  },
};


/**
 * Dev-only demo accounts (F-29): the old persona cards, collapsed by default so a real visitor never sees them as the way in.
 * The page that renders this is already a 404 when mock mode is off.
 */
export default function DemoAccounts({ lang, next }: { lang: Locale; next: string | null }) {
  const c = copy[lang].auth;
  const profiles = getStore().read().profiles;
  return (
    <details className="group rounded-[28px] border border-line bg-panel p-4 sm:p-5" data-demo-accounts>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-sm)] font-bold text-fg [&::-webkit-details-marker]:hidden">
        <span>{c.demoTitle}</span>
        <span aria-hidden className="text-fg-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"><ArrowRight size={18} /></span>
      </summary>
      <p className="mt-2 text-sm text-fg-muted">{c.demoLead}</p>
      <ul aria-label={c.demoPick} className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PERSONAS.map((p) => {
          const who = WHO[p.handle] ?? WHO.anuujin;
          const me = profiles.find((x) => x.handle === p.handle);
          const person = (me && (tf(me.name, lang) || me.handle)) || p.label[lang];
          // Home is where the work is: staff open the backoffice, everyone else their member app (a requested page wins).
          const to = next ?? (p.role === "admin" || p.role === "organizer" ? `/${lang}/admin` : `/${lang}/me`);
          return (
            <li key={p.handle}>
              <form action={signInAs} className="relative grid h-full content-between gap-4 overflow-hidden rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-card)]" style={{ background: `radial-gradient(120% 120% at 100% 0%, ${who.wash}, var(--ops-panel) 62%)` }}>
                <input type="hidden" name="handle" value={p.handle} />
                <input type="hidden" name="lang" value={lang} />
                <input type="hidden" name="next" value={to} />
                <Icon3D name={who.icon} sizes="96px" className="pointer-events-none absolute -top-1 -right-1 size-16 rotate-6 drop-shadow-[0_10px_12px_rgb(0_40_70/0.25)]" />
                <div className="flex items-center gap-3 pr-14">
                  <Avatar name={person} src={me?.avatar_path} size={52} className="ring-2 ring-white" />
                  <div className="grid min-w-0 gap-1">
                    <p className="text-xs font-semibold text-fg-muted">{c.demoAs}</p>
                    <h2 className="font-display text-lg leading-tight font-black text-fg [overflow-wrap:anywhere]">{p.label[lang]}</h2>
                    <p><span className="inline-flex rounded-full bg-panel px-2.5 py-0.5 text-xs font-bold text-accent-fg ring-1 ring-line">{who.role[lang]}</span></p>
                  </div>
                </div>
                <div className="grid gap-2">
                  <p className="text-sm font-bold text-fg">{c.demoCan}</p>
                  <ul className="grid gap-1.5 text-sm text-fg-muted">
                    {who.can[lang].map((t) => <li key={t} className="flex items-start gap-2"><Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-ok-fg" />{t}</li>)}
                  </ul>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-fg-muted"><ArrowRight aria-hidden="true" size={14} />{who.lands[lang]}</p>
                </div>
                <Button type="submit" size="lg" className="min-h-12 w-full">{c.demoCta}</Button>
              </form>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
