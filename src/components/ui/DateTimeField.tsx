"use client";
import Field from "./Field";
import { Input } from "./Field";
import { fromUbInput, toUbInput } from "@/lib/time";

/**
 * Date + time picked on the Ulaanbaatar wall clock regardless of the browser's zone. The visible input holds the UB
 * wall time; a hidden input submits the exact UTC instant (ISO) under `name`, so servers never guess the zone.
 */
export default function DateTimeField({ name, label, tzLabel, value, onChange, hint, error, required }: {
  name: string; label: string; tzLabel: string; value: Date | null; onChange: (d: Date | null) => void;
  hint?: string; error?: string; required?: boolean;
}) {
  return (
    <Field label={label} hint={hint ? `${tzLabel} · ${hint}` : tzLabel} error={error} required={required}>
      {(c) => (
        <>
          <Input type="datetime-local" {...c} value={value ? toUbInput(value) : ""} onChange={(e) => onChange(fromUbInput(e.target.value))} />
          <input type="hidden" name={name} value={value ? value.toISOString() : ""} />
        </>
      )}
    </Field>
  );
}
