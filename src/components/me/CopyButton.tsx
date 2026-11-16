"use client";
import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { pill } from "./pill";
import { cx } from "@/components/ui/cx";

/**
 * Copies text to the clipboard. A value starting with "/" is made absolute with the current origin at click time
 * (invite links). The icon cross-fades Copy → Check in 300ms (no bounce) and "Copied" is announced politely.
 */
export default function CopyButton({ value, label, copiedLabel, variant = "soft", className }: {
  value: string; label: string; copiedLabel: string; variant?: "soft" | "danger"; className?: string;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    const text = value.startsWith("/") ? `${window.location.origin}${value}` : value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API unavailable (insecure context / denied): fall back to a transient textarea selection.
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    setDone(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 2000);
  }

  return (
    <button type="button" onClick={copy} className={cx(pill[variant], className)}>
      <span aria-hidden="true" className="relative inline-block size-4">
        <Copy size={16} className={cx("absolute inset-0 transition-opacity duration-300", done ? "opacity-0" : "opacity-100")} />
        <Check size={16} className={cx("absolute inset-0 text-ok-fg transition-opacity duration-300", done ? "opacity-100" : "opacity-0")} />
      </span>
      {done ? copiedLabel : label}
      <span role="status" className="sr-only">{done ? copiedLabel : ""}</span>
    </button>
  );
}
