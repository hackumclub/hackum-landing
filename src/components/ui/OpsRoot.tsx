"use client";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "./cx";

export type ThemePref = "system" | "light" | "dark";
const KEY = "ops-theme";
const isPref = (v: unknown): v is ThemePref => v === "system" || v === "light" || v === "dark";

type Ctx = { root: HTMLElement | null; theme: ThemePref; setTheme: (t: ThemePref) => void };
const OpsContext = createContext<Ctx>({ root: null, theme: "system", setTheme: () => {} });

/** Portalled overlays (dialogs, drawers, toasts) mount inside the ops root so they inherit its theme tokens. */
export const useOpsPortal = () => useContext(OpsContext).root ?? undefined;
export const useOpsTheme = () => useContext(OpsContext);

// Runs before paint, so a saved dark/light choice never flashes the wrong theme (see Next docs:
// guides/preventing-flash-before-hydration). Reads only localStorage; failures fall back to the system theme.
const NO_FLASH = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.currentScript.parentElement.dataset.theme=t}catch(e){}`;

// The saved preference is external state (localStorage, shared across tabs), so it is read with useSyncExternalStore.
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => { listeners.delete(cb); window.removeEventListener("storage", cb); };
}
function readPref(): ThemePref {
  try { const v = localStorage.getItem(KEY); return isPref(v) ? v : "system"; } catch { return "system"; }
}
function setTheme(t: ThemePref) {
  try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
}

/** Wraps the backoffice / member app: applies `.ops` tokens and owns the theme preference. */
export default function OpsRoot({ children, className }: { children: ReactNode; className?: string }) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const theme = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePref);

  return (
    <OpsContext.Provider value={{ root, theme, setTheme }}>
      <div ref={setRoot} className={cx("ops min-h-dvh", className)} data-theme={theme === "system" ? undefined : theme} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        {children}
      </div>
    </OpsContext.Provider>
  );
}
