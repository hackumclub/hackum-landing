"use client";
import { useId } from "react";
import type { L, Locale } from "@/i18n/config";
import { signInAs } from "@/lib/server/auth-actions";

/** Mock-auth "view as" control: switching persona is how you see the app as an organizer, a member, a guest or an alumnus. */
export default function PersonaSwitcher({ lang, personas, current, labels }: {
  lang: Locale; personas: { handle: string; label: L }[]; current: string | null; labels: { viewingAs: string; signedOut: string };
}) {
  const id = useId();
  return (
    <form action={signInAs} className="flex items-center gap-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="next" value={`/${lang}/me`} />
      <label className="sr-only" htmlFor={id}>{labels.viewingAs}</label>
      <select
        id={id}
        name="handle"
        defaultValue={current ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-h-10 max-w-44 cursor-pointer rounded-full border border-[var(--ops-line)] bg-neutral-soft px-3 text-sm font-bold text-fg md:max-w-52"
      >
        <option value="">{labels.signedOut}</option>
        {personas.map((p) => <option key={p.handle} value={p.handle}>{p.label[lang]}</option>)}
      </select>
    </form>
  );
}
