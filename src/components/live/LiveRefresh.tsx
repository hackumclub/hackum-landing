"use client";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

const BASE_MS = 1_000;
const MAX_MS = 30_000;

/** Full-jitter exponential backoff: a random delay in [0, min(30 s, 1 s · 2^attempt)). Spreads reconnects after an outage. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  return Math.floor(random() * Math.min(MAX_MS, BASE_MS * 2 ** Math.max(0, attempt)));
}

/**
 * Keeps server-rendered pages in step with the mock database: when anyone changes data (another tab, another persona,
 * the background dispatcher) the server sends a new version and this refreshes the page in place. Renders nothing.
 * Reconnects with exponential backoff + full jitter (max 30 s) and stays disconnected while the tab is hidden.
 */
export default function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let last: number | null = null;

    const close = () => { es?.close(); es = null; clearTimeout(retry); };

    const connect = () => {
      close();
      if (document.hidden) return; // resumed by the visibilitychange handler
      const source = new EventSource("/api/dev/stream");
      es = source;
      source.onopen = () => { attempt = 0; };
      source.onmessage = (e) => {
        attempt = 0;
        const v = (JSON.parse(e.data) as { v: number }).v;
        if (last !== null && v !== last) {
          clearTimeout(debounce);
          debounce = setTimeout(() => startTransition(() => router.refresh()), 150); // coalesce bursts of changes
        }
        last = v;
      };
      source.onerror = () => {
        source.close();
        if (es === source) es = null;
        retry = setTimeout(connect, backoffDelay(attempt++));
      };
    };

    const onVisibility = () => { if (document.hidden) close(); else { attempt = 0; connect(); } };

    document.addEventListener("visibilitychange", onVisibility);
    connect();
    return () => { document.removeEventListener("visibilitychange", onVisibility); close(); clearTimeout(debounce); };
  }, [router]);

  return null;
}
