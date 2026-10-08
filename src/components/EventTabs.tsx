"use client";
import { useId, useState } from "react";

/** Accessible tabs (roving selection with ← →). Labels come from the dictionary; panels are server-rendered nodes. */
export default function EventTabs({ labels, panels }: { labels: string[]; panels: React.ReactNode[] }) {
  const [tab, setTab] = useState(0);
  const id = useId();
  return (
    <div>
      <div role="tablist" className="flex gap-6 border-b border-ink/10"
        onKeyDown={(e) => { if (e.key === "ArrowRight") setTab((t) => (t + 1) % labels.length); if (e.key === "ArrowLeft") setTab((t) => (t - 1 + labels.length) % labels.length); }}>
        {labels.map((l, i) => (
          <button key={l} id={`${id}-t${i}`} role="tab" type="button" aria-selected={tab === i} aria-controls={`${id}-p${i}`} tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            className={`-mb-px border-b-2 py-3 font-display text-sm font-bold transition-colors ${tab === i ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>
      <div id={`${id}-p${tab}`} role="tabpanel" aria-labelledby={`${id}-t${tab}`} className="py-8">{panels[tab]}</div>
    </div>
  );
}
