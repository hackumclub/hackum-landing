"use client";
import * as P from "@radix-ui/react-popover";
import { useSyncExternalStore, type ReactNode } from "react";
import Drawer from "./Drawer";
import { useOpsPortal } from "./OpsRoot";

const QUERY = "(max-width: 767px)";
const subscribe = (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const snapshot = () => (typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches);

/** True below 768px (the phone layout). False on the server and where `matchMedia` is missing (jsdom). */
export const usePhone = () => useSyncExternalStore(subscribe, snapshot, () => false);

/**
 * Where a picker's panel lives: a popover under its trigger from md up, a bottom sheet (the shared `Drawer`) on phones,
 * so a calendar or list is never clipped by the card or the viewport. `trigger` is the button that opens it.
 */
export default function PickerSurface({ open, onOpenChange, trigger, title, closeLabel, align = "start", contentClassName, autoFocusSelector, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; trigger: ReactNode; title: string; closeLabel: string; align?: "start" | "center" | "end";
  contentClassName?: string;
  /** CSS selector of the element to focus when the popover opens (default: the first tabbable). Ignored in the phone sheet. */
  autoFocusSelector?: string; children: ReactNode;
}) {
  const phone = usePhone();
  const container = useOpsPortal();
  if (phone) {
    return (
      <>
        <span className="contents" onClick={() => onOpenChange(true)}>{trigger}</span>
        <Drawer open={open} onOpenChange={onOpenChange} title={title} closeLabel={closeLabel}>{children}</Drawer>
      </>
    );
  }
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal container={container}>
        <P.Content
          align={align} sideOffset={8} collisionPadding={12}
          onOpenAutoFocus={autoFocusSelector ? (e) => { const el = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>(autoFocusSelector) ?? (e.target as HTMLElement | null)?.querySelector?.<HTMLElement>(autoFocusSelector); if (el) { e.preventDefault(); el.focus(); } } : undefined}
          className={contentClassName ?? "z-50 max-h-[var(--radix-popover-content-available-height)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[var(--radius-md)] border border-line bg-panel p-4 text-fg shadow-[var(--shadow-float)]"}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
