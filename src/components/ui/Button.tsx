import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line-strong bg-panel text-fg hover:bg-panel-2",
  ghost: "text-fg hover:bg-neutral-soft",
  danger: "bg-danger text-on-danger hover:brightness-95",
};
// lg = 44px: the minimum touch target in the member app.
const SIZE: Record<ButtonSize, string> = { sm: "min-h-9 px-3 text-sm", md: "min-h-10 px-4 text-sm", lg: "min-h-11 px-5 text-base" };

export const buttonClass = (variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) =>
  cx(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-sm)] font-semibold whitespace-nowrap transition-[background-color,filter] duration-150",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    VARIANT[variant], SIZE[size], className,
  );

type Own = { variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode };

export default function Button({ variant, size, icon, className, children, type = "button", ...rest }: Own & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, className, children, ...rest }: Own & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
