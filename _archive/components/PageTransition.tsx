"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap } from "@/motion/gsap";
import { EASE, MQ } from "@/motion/config";
import { setTransitioning } from "@/motion/page";

/**
 * Panel-wipe page transition for internal links (including MN/EN switching).
 * Exit: the blue panel rises over the page, then the router navigates. Enter: once the new pathname has
 * rendered, the panel slides away and waiting hero text (whenPageReady) starts. Reduced motion: plain navigation.
 */
export default function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest("a");
      const href = a?.getAttribute("href");
      if (!a || !href || !href.startsWith("/") || a.target || a.hasAttribute("download")) return;
      const url = new URL(href, location.href);
      if (url.pathname === location.pathname) return;
      if (!window.matchMedia(MQ.motion).matches || !panel.current) return;
      e.preventDefault();
      pending.current = true;
      setTransitioning(true);
      gsap.timeline()
        .set(panel.current, { display: "grid", yPercent: 100 })
        .to(panel.current, { yPercent: 0, duration: 0.5, ease: EASE.inOut })
        .add(() => router.push(url.pathname + url.search + url.hash, { scroll: false }));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  useEffect(() => {
    if (!pending.current || !panel.current) return;
    pending.current = false;
    // Let the new page paint and measure before revealing it.
    const id = requestAnimationFrame(() => {
      gsap.to(panel.current, {
        yPercent: -100, duration: 0.55, ease: EASE.inOut, delay: 0.05,
        onComplete: () => { gsap.set(panel.current, { display: "none" }); setTransitioning(false); },
      });
    });
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <div ref={panel} aria-hidden className="pointer-events-none fixed inset-0 z-[90] hidden place-items-center bg-[radial-gradient(120%_100%_at_50%_100%,#13a3ea,#0085ca_45%,#004a73)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- brand mark on the transition panel */}
      <img src="/img/brand/logo-128.png" alt="" width={72} height={72} className="h-[72px] w-[72px]" />
    </div>
  );
}
