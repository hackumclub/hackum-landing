"use client";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import IconButton from "@/components/ui/IconButton";
import { cx } from "@/components/ui/cx";

type Toast = { id: number; text: string; tone: "ok" | "error" };

/**
 * One transient message per screen. Success fades after 5s; an error stays until dismissed (it says what to do next).
 * The live region is always mounted so screen readers announce changes in its content.
 */
export function useToast(closeLabel: string): { show: (text: string, tone?: Toast["tone"]) => void; node: ReactNode } {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const show = useCallback((text: string, tone: Toast["tone"] = "ok") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    if (tone === "ok") timer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const node = (
    <div role={toast?.tone === "error" ? "alert" : "status"} className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      {toast && (
        <p
          key={toast.id}
          className={cx(
            "pointer-events-auto flex max-w-md items-start gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm font-semibold shadow-[var(--shadow-card)]",
            toast.tone === "error" ? "border-danger-fg bg-danger-soft text-danger-fg" : "border-line-strong bg-panel text-fg",
          )}
        >
          <span className="min-w-0 flex-1">{toast.text}</span>
          <IconButton size="sm" label={closeLabel} icon={<X size={14} />} onClick={() => setToast(null)} />
        </p>
      )}
    </div>
  );
  return { show, node };
}
