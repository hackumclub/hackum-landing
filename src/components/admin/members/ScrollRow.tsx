"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/**
 * A horizontally scrolling row (tabs, chips) with a visible cue: the edge that still has content behind it fades out, so a
 * clipped "Alumni" tab on a 360px phone reads as "more this way" instead of as a bug. Fades only while there is overflow.
 */
export default function ScrollRow({ children, className, ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  const [cue, setCue] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 4;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setCue((c) => (c.start === start && c.end === end ? c : { start, end }));
  }, []);
  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);
  const fade = `linear-gradient(90deg, ${cue.start ? "transparent, #000 36px" : "#000, #000"}, ${cue.end ? "#000 calc(100% - 36px), transparent" : "#000, #000"})`;
  return (
    <div
      ref={ref} onScroll={measure} {...rest}
      className={cx("overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}
      style={cue.start || cue.end ? { maskImage: fade, WebkitMaskImage: fade } : undefined}
    >
      {children}
    </div>
  );
}
