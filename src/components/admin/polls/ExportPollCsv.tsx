"use client";
import { Download } from "lucide-react";
import Button from "@/components/ui/Button";

/** Saves a CSV the server already built (formula-safe, BOM) as a file: a Blob in the browser, no extra request. */
export default function ExportPollCsv({ csv, file, label }: { csv: string; file: string; label: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return <Button variant="secondary" size="sm" icon={<Download aria-hidden="true" size={16} />} onClick={download}>{label}</Button>;
}
