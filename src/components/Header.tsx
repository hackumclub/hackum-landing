import { Suspense } from "react";
import AccountSlot, { SignedOutBar, SignedOutRows } from "@/components/auth/AccountSlot";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";
import HeaderBar from "./HeaderBar";

/**
 * The public bar. The static shell is signed-out (Sign in + Join); who is actually looking streams in behind two small
 * <Suspense> slots (desktop bar, 390 px Menu) so public pages stay static and cached.
 */
export default function Header({ lang, nav }: { lang: Locale; nav: Dict["nav"] }) {
  return (
    <HeaderBar
      lang={lang}
      nav={nav}
      account={<Suspense fallback={<SignedOutBar lang={lang} join={nav.join} />}><AccountSlot lang={lang} variant="bar" join={nav.join} /></Suspense>}
      accountMenu={<Suspense fallback={<SignedOutRows lang={lang} join={nav.join} />}><AccountSlot lang={lang} variant="menu" join={nav.join} /></Suspense>}
    />
  );
}
