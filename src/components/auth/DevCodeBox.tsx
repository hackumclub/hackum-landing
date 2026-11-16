import { KeyRound } from "lucide-react";
import { fill } from "@/i18n/config";

/** Demo only: the mock sends no email, so the code is shown here. Rendered only when the server handed a code back (mock mode). */
export default function DevCodeBox({ code, text, note }: { code: string; text: string; note: string }) {
  return (
    <div role="status" data-dev-code={code} className="grid gap-1 rounded-[var(--radius-md)] border-2 border-dashed border-line-strong bg-warn-soft px-4 py-3 text-sm text-fg">
      <p className="flex items-center gap-2 font-bold"><KeyRound aria-hidden size={16} className="shrink-0 text-warn-fg" /><span className="tnum">{fill(text, { code })}</span></p>
      <p className="text-fg-muted">{note}</p>
    </div>
  );
}
