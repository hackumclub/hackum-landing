import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "@/i18n/config";
import { EVENTS } from "@/lib/events";

const COOKIE = "lang";

/** Pick a locale: explicit cookie (set by the switcher) → Accept-Language → default (mn). */
function pickLocale(req: NextRequest): Locale {
  const saved = req.cookies.get(COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const header = req.headers.get("accept-language") ?? "";
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((x) => x.lang && !Number.isNaN(x.q))
    .sort((a, b) => b.q - a.q);
  return ranked.find((x) => (LOCALES as readonly string[]).includes(x.lang))?.lang as Locale | undefined ?? DEFAULT_LOCALE;
}

// A malformed %-sequence must not throw inside the proxy (that would be a 500); treat it as "no match".
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return ""; } };

/** Every page lives under /[lang]; unprefixed URLs are redirected to the visitor's locale. */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split("/")[1];
  // Malformed %-encoding makes Next throw "failed to decode param" (a 500) before any rewrite applies, so send the
  // visitor to a clean URL that renders the real 404 page.
  if (safeDecode(pathname) === "" && pathname !== "/") {
    const url = req.nextUrl.clone();
    url.pathname = `/${isLocale(first) ? first : pickLocale(req)}/page-not-found`;
    return NextResponse.redirect(url);
  }
  if (isLocale(first)) {
    // Unknown event slug → render the 404 route. (notFound() inside the page's Suspense would stream a 200 "soft 404".)
    const m = pathname.match(/^\/(?:mn|en)\/events\/([^/]+)\/?$/);
    if (m && !EVENTS.some((e) => e.slug === safeDecode(m[1]))) {
      const url = req.nextUrl.clone();
      url.pathname = `/${first}/page-not-found`;
      return NextResponse.rewrite(url);
    }
    return;
  }
  const url = req.nextUrl.clone();
  url.pathname = `/${pickLocale(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, metadata files and anything with a file extension (images, icons, fonts).
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
