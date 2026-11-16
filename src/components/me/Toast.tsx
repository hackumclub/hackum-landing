"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

/** Confirms an action in words ("RSVP cancelled") even when the card that triggered it disappears on refresh. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((m: string) => {
    clearTimeout(timer.current);
    setMessage(m);
    timer.current = setTimeout(() => setMessage(""), 4500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Always mounted so assistive tech registers the live region before the first message. */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 md:bottom-6">
        {message && <p className="pointer-events-auto max-w-sm rounded-[var(--radius-md)] bg-fg px-4 py-3 text-sm font-semibold text-canvas shadow-[var(--shadow-card)]">{message}</p>}
      </div>
    </ToastContext.Provider>
  );
}
