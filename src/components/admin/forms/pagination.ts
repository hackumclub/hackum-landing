import { fill, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import type { PaginationLabels } from "@/components/ui/DataTable";

/** DataTable pagination copy in the active language (the table's own defaults are English). */
export function paginationFor(lang: Locale): PaginationLabels {
  const p = copy[lang].forms.responses.pagination;
  return { nav: p.nav, previous: p.previous, next: p.next, page: (n) => fill(p.page, { n }), showing: (from, to, total) => fill(p.showing, { from, to, total }) };
}
