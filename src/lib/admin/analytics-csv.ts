import { csvCell } from "@/lib/csv-cell";
import type { Analytics } from "@/lib/mockdb/analytics";

/** Registrations-by-day as a spreadsheet file: UTF-8 BOM (Excel), CRLF, formula-safe cells. */
export function seriesToCsv(series: Analytics["registrationsByDay"], head: [string, string]): string {
  const lines = [head, ...series.map((p) => [p.day, String(p.n)])];
  return `\uFEFF${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
