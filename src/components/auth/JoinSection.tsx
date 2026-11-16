import { connection } from "next/server";
import CreateAccountForm from "@/components/auth/CreateAccountForm";
import { ButtonLink } from "@/components/ui/Button";
import { copy } from "@/i18n/areas/public";
import { tf, type Locale } from "@/i18n/config";
import { landingPath } from "@/lib/auth/landing";
import { formDefinition } from "@/lib/mockdb/forms";
import { openSeason } from "@/lib/mockdb/members";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { getSession } from "@/lib/server/session";

/** Request-time half of /join: the club's current questions (staff edit them), whether applications are open, who is looking. */
export default async function JoinSection({ lang, next }: { lang: Locale; next: string | null }) {
  await connection();
  const c = copy[lang].join;
  if (!mockEnabled()) return <p className="rounded-[var(--radius-md)] bg-accent-soft px-4 py-3 text-sm text-fg">{c.unavailable}</p>;
  const session = await getSession();
  if (session) {
    const db = getStore().read();
    const me = db.profiles.find((p) => p.id === session.profileId);
    return (
      <div className="grid gap-5 rounded-[28px] border border-line bg-panel p-6 shadow-[var(--shadow-card)] sm:p-8">
        <h1 className="font-display text-[clamp(26px,4vw,34px)] leading-tight font-black text-fg [overflow-wrap:anywhere]">{copy[lang].chrome.signedInAs.replace("{name}", (me && tf(me.name, lang)) || session.handle)}</h1>
        <div><ButtonLink href={landingPath(lang, next, { staff: !!session.staffRole, onboarded: session.onboarded })} size="lg">{session.staffRole ? copy[lang].chrome.dashboard : copy[lang].chrome.myHackum}</ButtonLink></div>
      </div>
    );
  }
  const db = getStore().read();
  return (
    <CreateAccountForm
      lang={lang}
      next={next}
      joinQuestions={formDefinition(db, "join")?.questions ?? []}
      membershipQuestions={formDefinition(db, "membership_application")?.questions ?? []}
      applicationsOpen={openSeason({ db, actor: null, now: new Date() }) !== null}
    />
  );
}
