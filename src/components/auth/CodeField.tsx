"use client";
import type { Ref } from "react";
import Field, { Input } from "@/components/ui/Field";

/** The one-field 6-digit code input: numeric keypad on phones, OS code autofill, digits only. */
export default function CodeField({ label, hint, error, value, onChange, name = "code", ref }: { label: string; hint?: string; error?: string; value: string; onChange(v: string): void; name?: string; ref?: Ref<HTMLInputElement> }) {
  return (
    <Field label={label} hint={hint} error={error} required>
      {(ctl) => (
        <Input {...ctl} ref={ref} name={name} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} spellCheck={false} placeholder="123456"
          className="min-h-12 text-center font-display text-2xl font-black tracking-[0.4em] tabular-nums" />
      )}
    </Field>
  );
}
