"use client";
import { useMemo, useState } from "react";
import EventTicket, { type EventData } from "./EventTicket";
import Sticker from "./Sticker";

const TILT = [-1.2, 0.8, -0.4, 1.1];

export default function HackathonList({ items }: { items: EventData[] }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((h) => !n || h.name.toLowerCase().includes(n) || (h.tagline ?? "").toLowerCase().includes(n) || (h.dates ?? "").includes(n));
  }, [items, q]);
  return (
    <div className="pb-16">
      <header className="relative mx-auto max-w-[1200px] px-6 pt-16">
        <h1 className="font-display text-[clamp(40px,6vw,72px)] font-black leading-none">Эвентүүд</h1>
        <p className="mt-4 max-w-xl text-lg text-muted">2019 оноос хойш бидний зохион байгуулсан хакатон, тэмцээнүүд. Тасалбар дээр дарж дэлгэрэнгүйг үзээрэй.</p>
        <label className="mt-8 flex max-w-md items-center gap-3 rounded-full bg-paper px-5 py-3 shadow-soft focus-within:ring-2 focus-within:ring-whisker">
          <span className="sr-only">Эвент хайх</span>
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-faint stroke-2"><circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Нэр эсвэл оноор хайх" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
        </label>
        <Sticker name="toast" className="absolute right-6 top-10 hidden w-40 rotate-6 md:block" />
      </header>
      {list.length === 0 ? (
        <div className="mx-auto mt-16 flex max-w-[1200px] flex-col items-start gap-4 px-6">
          <Sticker name="grumpy" className="w-28" />
          <p className="text-lg"><b>“{q}”</b> нэртэй эвент алга. Өөр нэр, эсвэл оноор (жишээ нь 2024) хайгаад үзээрэй.</p>
        </div>
      ) : (
        <div className="mx-auto mt-6 grid max-w-[1200px] gap-x-8 gap-y-6 px-6 md:grid-cols-2">
          {list.map((h, i) => <EventTicket key={h.slug} e={h} tilt={TILT[i % TILT.length]} />)}
        </div>
      )}
    </div>
  );
}
