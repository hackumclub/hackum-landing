"use client";
import * as AD from "@radix-ui/react-alert-dialog";
import type { ReactElement, ReactNode } from "react";
import { buttonClass } from "./Button";
import { useOpsPortal } from "./OpsRoot";

/**
 * Confirmation for consequential actions. Copy must name the object, the count and the verb
 * ("Cancel “DevHack 2026” and email 84 people"), never "Are you sure? OK". Escape and Cancel never confirm.
 */
export default function ConfirmDialog({ trigger, title, body, confirmLabel, cancelLabel, tone = "default", onConfirm }: {
  trigger: ReactElement; title: string; body: ReactNode; confirmLabel: string; cancelLabel: string;
  tone?: "danger" | "default"; onConfirm: () => void;
}) {
  const container = useOpsPortal();
  return (
    <AD.Root>
      <AD.Trigger asChild>{trigger}</AD.Trigger>
      <AD.Portal container={container}>
        <AD.Overlay className="fixed inset-0 z-50 bg-[rgb(7_27_41/0.55)]" />
        <AD.Content className="fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-6 text-fg shadow-[var(--shadow-card)]">
          <AD.Title className="font-display text-lg font-bold">{title}</AD.Title>
          <AD.Description className="text-sm text-fg-muted">{body}</AD.Description>
          <div className="flex flex-wrap justify-end gap-2">
            <AD.Cancel className={buttonClass("secondary")}>{cancelLabel}</AD.Cancel>
            <AD.Action className={buttonClass(tone === "danger" ? "danger" : "primary")} onClick={onConfirm}>{confirmLabel}</AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
