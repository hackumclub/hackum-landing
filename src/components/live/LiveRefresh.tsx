"use client";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

/**
 * Keeps the page in step with the mock database: when anyone changes data (another tab, another persona, the
 * background dispatcher) the server sends a new version and this refreshes the server-rendered content in place.
 * Renders a small status pill so it is obvious the screen is live.
 */
export default function LiveRefresh({ labels }: { labels: { live: string; reconnecting: string } }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);
  const last = useRef<number | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/dev/stream");
    let timer: ReturnType<typeof setTimeout> | undefined;
    es.onmessage = (e) => {
      setOnline(true);
      const v = (JSON.parse(e.data) as { v: number }).v;
      if (last.current !== null && v !== last.current) {
        clearTimeout(timer);
        timer = setTimeout(() => startTransition(() => router.refresh()), 150); // coalesce bursts of changes
      }
      last.current = v;
    };
    es.onerror = () => setOnline(false);
    return () => { clearTimeout(timer); es.close(); };
  }, [router]);

  return (
    <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-neutral-soft px-2.5 py-1 text-xs font-semibold text-fg">
      <span aria-hidden="true" className={online ? "size-2 rounded-full bg-c3 motion-safe:animate-pulse" : "size-2 rounded-full bg-c5"} />
      {online ? labels.live : labels.reconnecting}
    </span>
  );
}
