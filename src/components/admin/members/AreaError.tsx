"use client";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import Sticker from "@/components/Sticker";
import { isLocale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";

/** Route error for the Members / Comms / Settings / Audit areas: says what failed, offers one recovery action. */
export default function AreaError({ retry }: { retry: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = copy[isLocale(lang) ? lang : "mn"].common;
  return (
    <div role="alert" data-testid="area-error" className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-12 text-center">
      <Sticker name="offline" className="w-24" sizes="96px" />
      <h2 className="font-display text-lg font-bold text-fg">{t.errorTitle}</h2>
      <p className="max-w-md text-sm text-fg-muted">{t.errorLine}</p>
      <Button icon={<RotateCcw aria-hidden="true" size={16} />} onClick={() => retry()}>{t.retry}</Button>
    </div>
  );
}
