"use client";
import { Download, FileDown } from "lucide-react";
import { copy } from "@/i18n/areas/admin-reports";
import Button from "@/components/ui/Button";
import { useReport } from "./ReportProvider";

/** The export row: "Download PDF" (print dialog, one-line hint) and "Download all images". Never printed. */
export default function ReportToolbar() {
  const { lang, print, downloadAll, busy } = useReport();
  const t = copy[lang].tool;
  return (
    <div data-noprint="" role="group" aria-label={t.label} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button icon={<FileDown aria-hidden="true" size={16} />} onClick={print}>{t.pdf}</Button>
      <Button variant="secondary" icon={<Download aria-hidden="true" size={16} />} disabled={busy} onClick={() => { void downloadAll(); }}>{busy ? t.allImagesBusy : t.allImages}</Button>
      <p className="text-sm text-fg-muted">{t.pdfHint}</p>
    </div>
  );
}
