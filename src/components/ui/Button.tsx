import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "white" | "glass";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "ops-gloss",
  secondary: "border border-line bg-panel text-fg shadow-[var(--shadow-soft)] hover:border-line-strong/60 hover:bg-panel-2",
  ghost: "text-fg hover:bg-neutral-soft",
  danger: "bg-danger text-on-danger hover:brightness-95",
  // On a blue surface (Stage, sidebar): the public site's white pill and frosted pill.
  white: "bg-white text-[var(--ops-chrome-active-fg)] shadow-[0_8px_20px_-10px_rgb(0_40_80/0.5)] hover:bg-white/90",
  glass: "ops-glass hover:bg-white/25",
};
// lg = 44px: the minimum touch target in the member app.
const SIZE: Record<ButtonSize, string> = { sm: "min-h-9 px-3 text-sm", md: "min-h-10 px-4 text-sm", lg: "min-h-11 px-5 text-base" };

export const buttonClass = (variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) =>
  cx(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap transition-[background-color,filter] duration-150",
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
