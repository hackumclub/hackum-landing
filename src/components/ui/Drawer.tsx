"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import IconButton from "./IconButton";
import { useOpsPortal } from "./OpsRoot";

/** Side sheet (full-screen below 640px). Controlled; focus is trapped and restored by Radix. */
export default function Drawer({ open, onOpenChange, title, description, closeLabel, children }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; closeLabel: string; children: ReactNode;
}) {
  const container = useOpsPortal();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal container={container}>
        <D.Overlay className="fixed inset-0 z-40 bg-[rgb(7_27_41/0.45)]" />
        <D.Content className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-panel text-fg sm:w-[min(32rem,92vw)]">
          <div className="flex items-start justify-between gap-4 border-b border-line p-4">
            <div>
              <D.Title className="font-display text-lg font-bold">{title}</D.Title>
              {description ? <D.Description className="text-sm text-fg-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close asChild><IconButton label={closeLabel} icon={<X size={18} />} /></D.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
