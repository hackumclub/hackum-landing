"use client";
import { Download } from "lucide-react";
import Button from "@/components/ui/Button";
import { seriesToCsv } from "@/lib/admin/analytics-csv";
import type { DateRange } from "@/lib/date-range";

/** Downloads the registrations-by-day series: built in the browser as a Blob (UTF-8 BOM, formula-safe), no server round trip. */
export default function ExportCsv({ series, range, head, file, label }: {
  series: { day: string; n: number }[]; range: DateRange; head: [string, string]; file: string; label: string;
}) {
  const download = () => {
    const blob = new Blob([seriesToCsv(series, head)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${file}-${range.from}_${range.to}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <Button variant="secondary" size="sm" icon={<Download aria-hidden="true" size={16} />} onClick={download}>{label}</Button>;
}
