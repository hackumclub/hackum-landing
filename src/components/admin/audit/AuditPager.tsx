import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fill } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { buttonClass } from "@/components/ui/Button";

/** Server-rendered pager: every page is a URL (`?page=2`), so Back, reload and sharing all work. */
export default function AuditPager({ page, pages, from, to, total, hrefFor, c }: {
  page: number; pages: number; from: number; to: number; total: number; hrefFor: (page: number) => string; c: AreaCopy["audit"];
}) {
  if (total === 0) return null;
  return (
    <nav aria-label={c.pager} className="flex flex-wrap items-center justify-between gap-3">
      <p className="tnum text-sm text-fg-muted">{fill(c.showing, { from: from + 1, to, total })}</p>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1
            ? <Link href={hrefFor(page - 1)} rel="prev" scroll={false} className={buttonClass("secondary", "sm")}><ChevronLeft aria-hidden="true" size={14} />{c.prev}</Link>
            : <span aria-disabled="true" className={buttonClass("secondary", "sm")}><ChevronLeft aria-hidden="true" size={14} />{c.prev}</span>}
          <span className="tnum text-sm font-semibold text-fg">{fill(c.pageOf, { page, pages })}</span>
          {page < pages
            ? <Link href={hrefFor(page + 1)} rel="next" scroll={false} className={buttonClass("secondary", "sm")}>{c.next}<ChevronRight aria-hidden="true" size={14} /></Link>
            : <span aria-disabled="true" className={buttonClass("secondary", "sm")}>{c.next}<ChevronRight aria-hidden="true" size={14} /></span>}
        </div>
      )}
    </nav>
  );
}
