import type { ReactNode } from "react";
import Sticker from "@/components/Sticker";
import type { StickerName } from "@/lib/manul";

/** Мануул + title + one line + one action. The mascot lives here, not in the chrome. */
export default function EmptyState({ sticker, title, line, action }: { sticker: StickerName; title: string; line: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-dashed border-line bg-panel px-6 py-10 text-center">
      <Sticker name={sticker} className="w-24" sizes="96px" />
      <h3 className="font-display text-lg font-bold text-fg">{title}</h3>
      <p className="max-w-sm text-sm text-fg-muted">{line}</p>
      {action}
    </div>
  );
}
