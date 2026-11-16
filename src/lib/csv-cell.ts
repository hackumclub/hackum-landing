/** Spreadsheets run cells that start with = + - @ (or tab / CR) as formulas: a leading apostrophe keeps them text. */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: formula-safe, RFC 4180 quoting. Same rule as the forms export (`lib/forms/csv.ts`). */
export function csvCell(v: string): string {
  const s = FORMULA_START.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
