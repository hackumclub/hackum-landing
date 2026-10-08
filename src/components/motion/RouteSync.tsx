"use client";
import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { ScrollTrigger } from "@/motion/gsap";
import { ScrollSmoother } from "@/motion/smoother";

// Module-level (not a ref): this component can remount on navigation, and a ref would reset with it.
let lastPath: string | null = null;

/**
 * Every client-side navigation starts the new page at the top. Runs in a layout effect, i.e. after the new page's
 * DOM is committed but before it paints, so the old scroll offset (e.g. the bottom of the long home page) is never
 * shown on a shorter page as blank space under the footer. Then re-measures: ScrollTrigger.refresh() updates the
 * page height ScrollSmoother uses, and data-speed parallax is re-scanned for the new page. Renders nothing.
 * Lives in its own <Suspense> boundary (see the layout) because it reads usePathname().
 */
export default function RouteSync() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    if (lastPath === null) { lastPath = pathname; return; } // first load: the browser handles initial position
    if (lastPath === pathname) return;
    lastPath = pathname;

    const s = ScrollSmoother.get();
    if (s) s.scrollTop(0); // immediate jump, no smoothing
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    ScrollTrigger.refresh();
    if (s) { s.effects("[data-speed], [data-lag]"); s.scrollTop(0); }

    // Images/fonts on the new page can still change its height: measure once more after they settle.
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}
