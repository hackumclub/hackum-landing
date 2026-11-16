"use client";
import { useEffect, type RefObject } from "react";

/** Moves focus to the first control marked aria-invalid inside `ref` whenever a new (non-empty) error set arrives. */
export function useFocusFirstError(ref: RefObject<HTMLElement | null>, errors: object) {
  useEffect(() => {
    if (Object.keys(errors).length === 0) return;
    ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [ref, errors]);
}
