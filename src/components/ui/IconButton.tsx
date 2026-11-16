import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/** Icon-only button. `label` is required: it becomes the accessible name and the tooltip. */
export default function IconButton({ label, icon, size = "md", className, type = "button", ...rest }: { label: string; icon: ReactNode; size?: "sm" | "md" | "lg" } & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        "inline-grid cursor-pointer place-items-center rounded-[var(--radius-sm)] text-fg-muted transition-colors duration-150 hover:bg-neutral-soft hover:text-fg disabled:cursor-not-allowed disabled:opacity-50",
        // sm = 24px, the WCAG 2.2 (2.5.8) minimum target; use only for secondary inline actions.
        size === "lg" ? "size-11" : size === "sm" ? "size-6" : "size-10",
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
