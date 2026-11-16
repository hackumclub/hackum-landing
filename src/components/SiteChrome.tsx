import { Suspense, type ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Cursor from "@/components/Cursor";
import SmoothScroll from "@/components/motion/SmoothScroll";
import RouteSync from "@/components/motion/RouteSync";
import type { Dict } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** Public-site chrome (skip link, glass header, custom cursor, smooth scroll, footer). Not used by /admin or /me. */
export default function SiteChrome({ lang, dict, children }: { lang: Locale; dict: Dict; children: ReactNode }) {
  return (
    <>
      <a href="#main" className="sr-only z-[95] rounded-full bg-brand px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">{dict.nav.skip}</a>
      {/* Fixed layers live outside the ScrollSmoother content (it is transformed). */}
      {/* Header and RouteSync read usePathname(); Next 16 requires a Suspense boundary for that on not-yet-known paths (the 404 catch-all). The page itself stays OUTSIDE any boundary so notFound() returns a real 404 status. */}
      <Suspense fallback={null}><Header lang={lang} nav={dict.nav} /><RouteSync /></Suspense>
      <Cursor />
      <SmoothScroll>
        <div className="flex min-h-screen flex-col overflow-x-clip pt-[72px]">
          <main id="main" className="flex-1">{children}</main>
          <Footer lang={lang} dict={dict} />
        </div>
      </SmoothScroll>
    </>
  );
}
