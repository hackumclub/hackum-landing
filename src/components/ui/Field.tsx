"use client";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";

export type FieldControlProps = { id: string; "aria-describedby"?: string; "aria-invalid"?: true; required?: boolean };

/** Label + control + hint/error, wired with ids so the hint and error are announced with the control. */
export default function Field({ label, labelAction, hint, error, required, className, children }: {
  label: ReactNode; labelAction?: ReactNode; hint?: ReactNode; error?: ReactNode; required?: boolean; className?: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cx("grid content-start gap-1.5", className)}>
      {/* Fixed-height label row so sibling fields line up whether or not one has an action. */}
      <div className="flex min-h-6 items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-fg">
          {label}
          {required && <span aria-hidden="true" className="text-danger-fg"> *</span>}
        </label>
        {labelAction}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required })}
      {error && <p id={errorId} className="text-sm font-semibold text-danger-fg">{error}</p>}
      {hint && <p id={hintId} className="text-sm text-fg-muted">{hint}</p>}
    </div>
  );
}

export const controlClass = (className?: string) =>
  cx(
    "w-full min-h-10 rounded-[var(--radius-sm)] border border-line-strong bg-panel px-3 py-2 text-sm text-fg placeholder:text-fg-muted",
    "aria-[invalid=true]:border-danger-fg disabled:cursor-not-allowed disabled:opacity-60",
    className,
  );

export const Input = ({ className, ...p }: ComponentProps<"input">) => <input className={controlClass(className)} {...p} />;
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => <textarea className={controlClass(cx("min-h-24", className))} {...p} />;
export const Select = ({ className, ...p }: ComponentProps<"select">) => <select className={controlClass(cx("pr-8", className))} {...p} />;
