/**
 * A table row is not focusable, so a drawer opened by clicking the row would have nothing to give focus back to on
 * Esc. Put focus on the row's own "open" button first (it carries `data-open="<id>"`); the drawer remembers it.
 */
export function focusRowOpener(id: string): void {
  if (typeof document === "undefined") return;
  document.querySelector<HTMLElement>(`[data-open="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
}
