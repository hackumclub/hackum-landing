import Link from "next/link";
import { LayoutDashboard, UserRound } from "lucide-react";
import { copy } from "@/i18n/areas/public";
import { href, tf, type Locale } from "@/i18n/config";
import { getStore } from "@/lib/mockdb/store";
import { getSession } from "@/lib/server/session";
import AccountMenu from "./AccountMenu";
import SignOutForm from "./SignOutForm";

const rowLink = "block rounded-2xl px-4 py-3 hover:bg-white/70";

/** Signed-out controls in the bar (also the static fallback while the session streams in). */
export function SignedOutBar({ lang, join }: { lang: Locale; join: string }) {
  return (
    <>
      <Link href={href(lang, "/sign-in")} className="hidden min-h-10 items-center rounded-full px-4 text-sm font-bold text-ink/80 transition-colors hover:bg-white/60 hover:text-ink sm:inline-flex">{copy[lang].chrome.signIn}</Link>
      <Link href={href(lang, "/join")} className="btn-primary hidden rounded-full px-5 py-2.5 text-sm sm:inline-block">{join}</Link>
    </>
  );
}

/** Signed-out rows in the 390 px Menu. */
export function SignedOutRows({ lang, join }: { lang: Locale; join: string }) {
  return (
    <>
      <li><Link href={href(lang, "/sign-in")} className={rowLink}>{copy[lang].chrome.signIn}</Link></li>
      <li><Link href={href(lang, "/join")} className={rowLink}>{join}</Link></li>
    </>
  );
}

/**
 * Request-time: reads the session, so it always sits behind <Suspense> (see authentication-with-cache-components).
 * Signed out → Sign in + Join. Signed in → avatar menu (My Hackum, Dashboard for staff, Sign out).
 */
export default async function AccountSlot({ lang, variant, join }: { lang: Locale; variant: "bar" | "menu" | "footer"; join: string }) {
  const c = copy[lang].chrome;
  const session = await getSession();
  if (!session) {
    if (variant === "bar") return <SignedOutBar lang={lang} join={join} />;
    if (variant === "menu") return <SignedOutRows lang={lang} join={join} />;
    return <li><Link href={href(lang, "/sign-in")} className="hover:text-brand">{c.signIn}</Link></li>;
  }
  const me = getStore().read().profiles.find((p) => p.id === session.profileId);
  const name = (me && tf(me.name, lang)) || session.handle;
  const staff = !!session.staffRole;
  const mine = href(lang, "/me");
  const dash = href(lang, "/admin");
  if (variant === "bar") {
    return <AccountMenu name={name} avatar={me?.avatar_path ?? null} staff={staff} labels={{ menu: c.accountMenu, signedInAs: c.signedInAs.replace("{name}", name), myHackum: c.myHackum, dashboard: c.dashboard, signOut: c.signOut }} mineHref={mine} dashHref={dash}
      signOut={<SignOutForm lang={lang} className="flex min-h-11 w-full cursor-pointer items-center rounded-xl px-3 text-left text-sm font-semibold text-ink hover:bg-brand-tint">{c.signOut}</SignOutForm>} />;
  }
  if (variant === "menu") {
    return (
      <>
        <li><Link href={mine} className={rowLink}>{c.myHackum}</Link></li>
        {staff && <li><Link href={dash} className={rowLink}>{c.dashboard}</Link></li>}
        <li><SignOutForm lang={lang} className={`${rowLink} w-full cursor-pointer text-left`}>{c.signOut}</SignOutForm></li>
      </>
    );
  }
  return (
    <>
      <li><Link href={mine} className="inline-flex items-center gap-2 hover:text-brand"><UserRound aria-hidden size={16} />{c.myHackum}</Link></li>
      {staff && <li><Link href={dash} className="inline-flex items-center gap-2 hover:text-brand"><LayoutDashboard aria-hidden size={16} />{c.dashboard}</Link></li>}
    </>
  );
}
