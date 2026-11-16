"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { copy } from "@/i18n/areas/admin-reports";
import type { Locale } from "@/i18n/config";
import type { DateRange } from "@/lib/date-range";

/** The report's period lives in the URL (`?from&to`); the default (this semester) keeps a clean URL. */
export default function RangeControls({ lang, range, custom, defaultRange }: { lang: Locale; range: DateRange; custom: boolean; defaultRange: DateRange }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const t = copy[lang].period;
  const go = (r: DateRange | null) => {
    const isDefault = !r || (r.from === defaultRange.from && r.to === defaultRange.to);
    start(() => router.push(isDefault ? `/${lang}/admin/reports` : `/${lang}/admin/reports?from=${r.from}&to=${r.to}`));
  };
  return (
    <div data-noprint="" role="group" aria-label={t.controls} aria-busy={pending || undefined} className="flex flex-wrap items-center gap-3">
      <DateRangePicker value={custom ? range : null} onChange={go} lang={lang} presets={["thisSemester", "lastSemester", "last30", "thisYear"]} labels={{ allDates: t.rangeDefault }} />
    </div>
  );
}
