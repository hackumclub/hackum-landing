"use client";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { fromUbInput, toUbInput } from "@/lib/time";
import DatePicker from "./DatePicker";
import Field from "./Field";
import TimeField from "./TimeField";

const T = { en: { time: "Time (HH:mm)", invalid: "Use 24-hour time such as 18:00." }, mn: { time: "Цаг (ЦЦ:мм)", invalid: "24 цагийн хэлбэрээр бичнэ үү, жишээ нь 18:00." } } as const;
const DEFAULT_TIME = "09:00";

/**
 * Date + time picked on the Ulaanbaatar wall clock regardless of the browser's zone: a themed calendar (`DatePicker`)
 * and a `HH:mm` field side by side. A hidden input submits the exact UTC instant (ISO) under `name`, so servers never
 * guess the zone. Picking a date first fills 09:00; typing a time first waits for the date.
 */
export default function DateTimeField({ name, label, tzLabel, value, onChange, hint, error, required, lang = "en" }: {
  name: string; label: string; tzLabel: string; value: Date | null; onChange: (d: Date | null) => void;
  hint?: string; error?: string; required?: boolean; lang?: Locale;
}) {
  const t = T[lang];
  const wall = value ? toUbInput(value) : null; // "YYYY-MM-DDTHH:mm"
  const date = wall?.slice(0, 10) ?? null;
  const time = wall?.slice(11, 16) ?? null;
  const [pendingTime, setPendingTime] = useState<string | null>(null);
  const emit = (d: string | null, tm: string | null) => onChange(d ? fromUbInput(`${d}T${tm ?? DEFAULT_TIME}`) : null);
  return (
    <Field label={label} hint={hint ? `${tzLabel} · ${hint}` : tzLabel} error={error} required={required}>
      {(c) => (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
            <DatePicker {...c} value={date} lang={lang} onChange={(d) => { emit(d, time ?? pendingTime); if (d) setPendingTime(null); }} />
            <TimeField
              label={`${label}: ${t.time}`} invalidLabel={t.invalid} value={time ?? pendingTime} aria-describedby={c["aria-describedby"]}
              onChange={(tm) => { if (date) emit(date, tm); else setPendingTime(tm); }}
            />
          </div>
          <input type="hidden" name={name} value={value ? value.toISOString() : ""} />
        </>
      )}
    </Field>
  );
}
