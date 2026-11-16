"use client";
import { useRef } from "react";
import { ImageDown } from "lucide-react";
import { fill } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-reports";
import Button from "@/components/ui/Button";
import { useReport } from "./ReportProvider";

/**
 * "Download image" for one chart: put it in the chart's `actions`. It finds its own `<figure>`, so the PNG carries the
 * title, takeaway, legend and marks. `chart` is the file-name part (`<report>-<chart>.png`); `chartTitle` names the button for screen readers.
 */
export default function DownloadChartImage({ chart, chartTitle }: { chart: string; chartTitle: string }) {
  const { lang, downloadOne, busy } = useReport();
  const t = copy[lang].tool;
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <Button
      ref={ref} variant="secondary" size="sm" icon={<ImageDown aria-hidden="true" size={16} />} disabled={busy}
      aria-label={fill(t.imageLabel, { chart: chartTitle })} data-chart-image="" data-chart={chart} data-noexport="" data-noprint=""
      onClick={() => { void downloadOne(ref.current?.closest("figure") ?? null, chart); }}
    >
      {t.image}
    </Button>
  );
}
