"use client";
import { useEffect, useRef, useState } from "react";

/** Content width of an element in CSS px (ResizeObserver), so SVG text stays 12px at 360px. `fallback` until measured and in tests. */
export function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => { const next = Math.round(el.getBoundingClientRect().width); if (next > 0) setW(next); };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
