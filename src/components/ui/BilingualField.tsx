"use client";
import { Copy } from "lucide-react";
import type { L } from "@/i18n/config";
import Field, { Input, Textarea } from "./Field";
import IconButton from "./IconButton";

export type BilingualLabels = { mn: string; en: string; copy: string; enMissing: string };

/** Mongolian and English side by side (stacked below 768px). Mongolian is the source; English can be copied from it. */
export default function BilingualField({ name, label, value, onChange, labels, multiline = false, required = "mn", error }: {
  name: string; label: string; value: L; onChange: (v: L) => void; labels: BilingualLabels;
  multiline?: boolean; required?: "mn" | "both" | "none"; error?: string;
}) {
  const Control = multiline ? Textarea : Input;
  const enMissing = value.mn.trim() !== "" && value.en.trim() === "";
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-bold text-fg">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={labels.mn} required={required !== "none"} error={error}>
          {(c) => <Control {...c} name={`${name}.mn`} lang="mn" value={value.mn} onChange={(e) => onChange({ ...value, mn: e.target.value })} />}
        </Field>
        <div className="relative">
          <Field label={labels.en} required={required === "both"} hint={enMissing ? labels.enMissing : undefined}>
            {(c) => <Control {...c} name={`${name}.en`} lang="en" value={value.en} onChange={(e) => onChange({ ...value, en: e.target.value })} />}
          </Field>
          <IconButton
            label={labels.copy}
            icon={<Copy size={16} />}
            className="absolute -top-2 right-0"
            disabled={value.mn.trim() === ""}
            onClick={() => onChange({ ...value, en: value.mn })}
          />
        </div>
      </div>
    </fieldset>
  );
}
