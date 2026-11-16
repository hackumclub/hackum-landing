"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import IconButton from "./IconButton";
import { useOpsPortal } from "./OpsRoot";

/**
 * Floating rounded side panel from `sm` up, bottom sheet with a grab handle on phones. Controlled; Radix traps focus,
 * closes on Esc / overlay click and returns focus to the trigger.
 */
export default function Drawer({ open, onOpenChange, title, description, closeLabel, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; closeLabel: string; children: ReactNode;
}) {
  const container = useOpsPortal();
  // Drawers are opened from state (a table row, a menu item), not from a Radix Trigger, so Radix has nothing to
  // return focus to. Remember what had focus when the drawer opened and put it back when it closes.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal container={container}>
        <D.Overlay className="fixed inset-0 z-40 bg-[rgb(7_27_41/0.45)]" />
        <D.Content
          onOpenAutoFocus={() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={(e) => {
            const el = opener.current;
            opener.current = null;
            if (el?.isConnected) { e.preventDefault(); el.focus(); }
          }}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-line bg-panel text-fg shadow-[var(--shadow-float)] sm:inset-x-auto sm:inset-y-3 sm:right-3 sm:max-h-none sm:w-[min(32rem,calc(100vw-1.5rem))] sm:rounded-[28px] sm:border sm:shadow-[var(--shadow-float)]"
        >
          <div data-grab-handle="" aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-3 sm:pt-5">
            <div>
              <D.Title className="font-display text-lg font-bold">{title}</D.Title>
              {description ? <D.Description className="text-sm text-fg-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close asChild><IconButton label={closeLabel} icon={<X size={18} />} /></D.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
