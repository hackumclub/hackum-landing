import LiveRefresh from "@/components/live/LiveRefresh";
import { copy } from "@/i18n/areas/public";
import type { Locale } from "@/i18n/config";

/**
 * The shared "live" indicator on public pages: it keeps server-rendered counts in step with the database.
 * LiveRefresh is styled with the ops tokens, so it sits inside an `.ops` scope with a transparent background
 * (the public page's own background shows through); nothing else on the page uses those tokens.
 */
export default function LivePill({ lang }: { lang: Locale }) {
  return <span className="ops inline-block rounded-full" style={{ background: "transparent" }}><LiveRefresh labels={copy[lang].live} /></span>;
}
