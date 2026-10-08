"use client";
import { useState } from "react";

const TABS = ["Overview", "Prizes", "Schedule"] as const;
const LABELS: Record<(typeof TABS)[number], string> = { Overview: "Тойм", Prizes: "Шагнал", Schedule: "Хугацаа" };

export default function HackathonTabs({ overview, prizes, schedule }: { overview: React.ReactNode; prizes: React.ReactNode; schedule: React.ReactNode }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const body = { Overview: overview, Prizes: prizes, Schedule: schedule }[tab];
  return (
    <div>
      <div role="tablist" className="flex gap-6 border-b border-black/10">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 py-3 font-display text-sm font-bold ${tab === t ? "border-brand text-brand" : "border-transparent text-muted"}`}>{LABELS[t]}</button>
        ))}
      </div>
      <div role="tabpanel" className="py-8">{body}</div>
    </div>
  );
}
