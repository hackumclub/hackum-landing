"use client";
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/motion/gsap";
import { ScrollSmoother } from "@/motion/smoother";
import { MQ } from "@/motion/config";

/**
 * ScrollSmoother wrapper (desktop with a hover pointer and motion allowed; touch keeps native scroll).
 * Created once for the whole app. It deliberately does not read the URL: that keeps the page itself outside any
 * Suspense boundary, which is what lets `notFound()` return a real 404 status. Route changes are handled by
 * <RouteSync/>. ScrollTrigger is refreshed once fonts and images have loaded so positions use the final layout.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MQ.full, () => {
      // Pass the elements themselves. Selector strings would be resolved *inside* the useGSAP scope, miss the
      // wrapper, and make ScrollSmoother insert its own wrapper div into React's DOM, which React then can't clean
      // up when the layout is replaced (e.g. on a language switch), leaving stale nodes and blank space.
      const s = ScrollSmoother.create({ wrapper: wrapper.current!, content: content.current!, smooth: 1, effects: true, smoothTouch: false });
      return () => s.kill();
    });
    return () => mm.revert();
  }, { scope: wrapper });

  useEffect(() => {
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);
    return () => window.removeEventListener("load", refresh);
  }, []);

  return (
    <div id="smooth-wrapper" ref={wrapper}>
      <div id="smooth-content" ref={content}>{children}</div>
    </div>
  );
}
