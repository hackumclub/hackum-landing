import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { signOutAction } from "@/lib/server/auth-actions";

/** A real form post, so signing out works before JavaScript loads. `children` is the button content. */
export default function SignOutForm({ lang, className, children }: { lang: Locale; className?: string; children: ReactNode }) {
  return (
    <form action={signOutAction.bind(null, { lang })}>
      <button type="submit" className={className}>{children}</button>
    </form>
  );
}
