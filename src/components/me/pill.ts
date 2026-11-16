import { cx } from "@/components/ui/cx";

/**
 * Pill buttons for the member app: 44 px, one line, icon left, soft 1 px border. `soft` = secondary, `danger` = quiet
 * destructive text button (no border until hover), `primary` stays `buttonClass("primary", "lg")` from ui/Button.
 */
const pillBase = "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-bold whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";
export const pill = {
  soft: cx(pillBase, "border border-line bg-panel-2 text-fg hover:bg-neutral-soft"),
  danger: cx(pillBase, "text-danger-fg hover:bg-danger-soft"),
};
