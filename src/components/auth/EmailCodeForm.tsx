"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import Field, { Input } from "@/components/ui/Field";
import { copy } from "@/i18n/areas/public";
import { fill, type Locale } from "@/i18n/config";
import { requestCodeAction, verifyCodeAction } from "@/lib/server/auth-actions";
import CodeField from "./CodeField";
import DevCodeBox from "./DevCodeBox";
import { codeErrorKey, sendErrorKey } from "./errors";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Sign in with an emailed code: step 1 email → step 2 six-digit code. Errors sit beside the field they belong to. */
export default function EmailCodeForm({ lang, next }: { lang: Locale; next?: string | null }) {
  const c = copy[lang].auth;
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [note, setNote] = useState<string>();
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  const send = (resend: boolean) => {
    const value = email.trim();
    if (!value) { setEmailError(c.errors.emailRequired); emailRef.current?.focus(); return; }
    if (!EMAIL.test(value)) { setEmailError(c.errors.emailInvalid); emailRef.current?.focus(); return; }
    setEmailError(undefined); setCodeError(undefined); setNote(undefined);
    start(async () => {
      const r = await requestCodeAction({ email: value, lang });
      if (!r.ok) {
        const msg = c.errors[sendErrorKey(r.error)];
        if (resend) setCodeError(msg); else { setEmailError(msg); emailRef.current?.focus(); }
        return;
      }
      setDevCode(r.devCode ?? null);
      setCode("");
      if (resend) { setNote(c.resent); codeRef.current?.focus(); } else setStep("code");
    });
  };

  const verify = () => {
    if (!/^\d{6}$/.test(code)) { setCodeError(c.errors.codeRequired); codeRef.current?.focus(); return; }
    setCodeError(undefined);
    start(async () => {
      const r = await verifyCodeAction({ email: email.trim(), code, lang, next });
      // Success redirects, so a returned value is always a failure.
      setCodeError(c.errors[codeErrorKey(r.error)]);
      codeRef.current?.focus();
    });
  };

  if (step === "email") {
    return (
      <form noValidate onSubmit={(e) => { e.preventDefault(); send(false); }} className="grid gap-4">
        <Field label={c.email} hint={c.emailHint} error={emailError} required>
          {(ctl) => <Input {...ctl} ref={emailRef} name="email" type="email" autoComplete="email" inputMode="email" className="min-h-11" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? c.sending : c.sendCode}</Button>
      </form>
    );
  }
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); verify(); }} className="grid gap-4">
      <CodeField ref={codeRef} label={c.codeLabel} hint={fill(c.codeHint, { email: email.trim() })} error={codeError} value={code} onChange={setCode} />
      {devCode && <DevCodeBox code={devCode} text={c.devCode} note={c.devNote} />}
      {note && <p role="status" className="text-sm font-semibold text-ok-fg">{note}</p>}
      <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? c.verifying : c.verify}</Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" disabled={pending} onClick={() => send(true)} className="min-h-11 cursor-pointer font-semibold text-accent-fg underline decoration-2 underline-offset-4">{c.resend}</button>
        <button type="button" onClick={() => { setStep("email"); setCode(""); setCodeError(undefined); setNote(undefined); }} className="min-h-11 cursor-pointer font-semibold text-fg-muted underline decoration-2 underline-offset-4">{c.changeEmail}</button>
      </div>
    </form>
  );
}
