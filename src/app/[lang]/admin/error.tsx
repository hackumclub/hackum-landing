"use client";
import { useParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import Button from "@/components/ui/Button";
import Sticker from "@/components/Sticker";

/** Admin route error: says what failed and offers one recovery action. The error itself is logged server-side. */
export default function AdminError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lang } = useParams<{ lang: string }>();
  const t = getDictionary(isLocale(lang) ? lang : "mn").admin.dashboard;
  return (
    <div role="alert" className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-12 text-center">
      <Sticker name="offline" className="w-24" sizes="96px" />
      <h2 className="font-display text-lg font-bold text-fg">{t.errorTitle}</h2>
      <p className="max-w-md text-sm text-fg-muted">{t.errorLine}</p>
      <Button icon={<RotateCcw aria-hidden="true" size={16} />} onClick={() => retry()}>{t.retry}</Button>
    </div>
  );
}
