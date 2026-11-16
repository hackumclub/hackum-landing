"use client";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import Button from "@/components/ui/Button";
import Sticker from "@/components/Sticker";

/** Error boundary for every events screen: says what failed and offers the one recovery action (retry re-renders the segment). */
export default function EventsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = copy[isLocale(lang) ? lang : "mn"].error;
  return (
    <div role="alert" className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-12 text-center">
      <Sticker name="offline" className="w-24" sizes="96px" />
      <h2 className="font-display text-lg font-bold text-fg">{t.title}</h2>
      <p className="max-w-md text-sm text-fg-muted">{t.line}</p>
      <Button icon={<RotateCcw aria-hidden="true" size={16} />} onClick={() => retry()}>{t.retry}</Button>
    </div>
  );
}
