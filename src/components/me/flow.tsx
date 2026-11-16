"use client";
import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * A guided flow (the application form) owns the bottom of the screen with its own Back / Next bar, so the floating tab bar
 * steps aside while it is on screen. MeShell provides the setter; flows call `useHideTabs(true)` while they are active.
 */
const FlowContext = createContext<(hidden: boolean) => void>(() => {});
export const FlowProvider = ({ set, children }: { set: (hidden: boolean) => void; children: ReactNode }) => <FlowContext.Provider value={set}>{children}</FlowContext.Provider>;

export function useHideTabs(active: boolean) {
  const set = useContext(FlowContext);
  useEffect(() => {
    if (!active) return;
    set(true);
    return () => set(false);
  }, [active, set]);
}
