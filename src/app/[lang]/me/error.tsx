"use client";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import Button from "@/components/ui/Button";
import Sticker from "@/components/Sticker";

/** Route error: says what failed and offers one recovery action (Next 16 passes `retry`, not `reset`). */
export default function MeError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = copy[isLocale(lang) ? lang : "mn"].errors;
  return (
    <div role="alert" className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-12 text-center">
      <Sticker name="offline" className="w-24" sizes="96px" />
      <h2 className="font-display text-lg font-bold text-fg">{t.title}</h2>
      <p className="max-w-md text-sm text-fg-muted">{t.line}</p>
      <Button size="lg" icon={<RotateCcw aria-hidden="true" size={16} />} onClick={() => retry()}>{t.retry}</Button>
    </div>
  );
}
