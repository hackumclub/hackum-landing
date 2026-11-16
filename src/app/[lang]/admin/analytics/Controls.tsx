"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import DateRangePicker from "@/components/ui/DateRangePicker";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import type { Locale } from "@/i18n/config";
import { analyticsHref, TABS, type Tab } from "@/lib/admin/analytics-href";
import type { DateRange } from "@/lib/date-range";

/** Range picker (URL = source of truth) and the routed section tabs that keep the range when switching. */
export default function Controls({ lang, tab, range, custom, defaultRange, defaultLabel, tabLabels, tabsLabel }: {
  lang: Locale; tab: Tab; range: DateRange; custom: boolean; defaultRange: DateRange; defaultLabel: string; tabLabels: Record<Tab, string>; tabsLabel: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (r: DateRange | null) => {
    const isDefault = !r || (r.from === defaultRange.from && r.to === defaultRange.to);
    start(() => router.push(analyticsHref(lang, { tab, range: isDefault ? null : r })));
  };
  const urlRange = custom ? range : null;
  return (
    <div className="grid gap-3" aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={urlRange} onChange={go} lang={lang} presets={["thisSemester", "lastSemester", "last30", "thisYear"]} labels={{ allDates: defaultLabel }} />
      </div>
      <SegmentedTabs
        ariaLabel={tabsLabel} value={tab}
        items={TABS.map((k) => ({ key: k, label: tabLabels[k] }))}
        hrefs={Object.fromEntries(TABS.map((k) => [k, analyticsHref(lang, { tab: k, range: urlRange })]))}
      />
    </div>
  );
}
