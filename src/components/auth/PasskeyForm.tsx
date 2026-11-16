"use client";
import { useRef, useState, useTransition } from "react";
import { Fingerprint } from "lucide-react";
import Button from "@/components/ui/Button";
import Field, { Input } from "@/components/ui/Field";
import { copy } from "@/i18n/areas/public";
import type { Locale } from "@/i18n/config";
import { passkeyAction } from "@/lib/server/auth-actions";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Passkey sign-in (mock): honest about accounts that have no passkey yet. */
export default function PasskeyForm({ lang, next }: { lang: Locale; next?: string | null }) {
  const c = copy[lang].auth;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  const submit = () => {
    const value = email.trim();
    if (!EMAIL.test(value)) { setError(value ? c.errors.emailInvalid : c.errors.emailRequired); ref.current?.focus(); return; }
    setError(undefined);
    start(async () => {
      const r = await passkeyAction({ email: value, lang, next });
      setError(r.error === "not_found" ? c.errors.noPasskey : r.error === "invalid" ? c.errors.emailInvalid : c.errors.server);
      ref.current?.focus();
    });
  };

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-4">
      <p className="text-sm text-fg-muted">{c.passkeyLead}</p>
      <Field label={c.email} error={error} required>
        {(ctl) => <Input {...ctl} ref={ref} name="email" type="email" autoComplete="username webauthn" inputMode="email" className="min-h-11" value={email} onChange={(e) => setEmail(e.target.value)} />}
      </Field>
      <Button type="submit" size="lg" disabled={pending} icon={<Fingerprint aria-hidden size={18} />} className="w-full">{pending ? c.passkeyBusy : c.passkeyCta}</Button>
    </form>
  );
}
