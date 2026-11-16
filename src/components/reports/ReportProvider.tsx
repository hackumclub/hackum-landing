"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fill, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-reports";
import { useToast } from "@/components/admin/events/Toast";
import { exportFigure } from "./chart-image";

const GAP_MS = 150;

type Ctx = {
  lang: Locale;
  /** File-name base, e.g. "pitch-night-autumn". Each image is saved as `<name>-<chart>.png`. */
  name: string;
  busy: boolean;
  downloadOne: (figure: HTMLElement | null, chart: string) => Promise<boolean>;
  downloadAll: () => Promise<void>;
  print: () => void;
};
const ReportContext = createContext<Ctx | null>(null);
export const useReport = (): Ctx => {
  const c = useContext(ReportContext);
  if (!c) throw new Error("useReport needs a ReportProvider");
  return c;
};

/**
 * Behaviour shared by one report page: one toast for errors and confirmations, "Download PDF" (the browser's print
 * dialog; the document title is the suggested file name), image export for one chart or for all of them in turn, and a
 * light theme while printing (dark mode never reaches paper).
 */
export default function ReportProvider({ lang, name, title, children }: { lang: Locale; name: string; title: string; children: ReactNode }) {
  const t = copy[lang].tool;
  const { show, node } = useToast(t.close);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    const before = document.title;
    document.title = title;
    let root: HTMLElement | null = null;
    let prev: string | undefined;
    const onBefore = () => {
      document.title = title;
      root = document.querySelector<HTMLElement>(".ops");
      prev = root?.dataset.theme;
      if (root) root.dataset.theme = "light";
    };
    const onAfter = () => {
      if (!root) return;
      if (prev === undefined) delete root.dataset.theme;
      else root.dataset.theme = prev;
    };
    window.addEventListener("beforeprint", onBefore);
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("beforeprint", onBefore);
      window.removeEventListener("afterprint", onAfter);
      document.title = before;
    };
  }, [title]);

  const downloadOne = useCallback(async (figure: HTMLElement | null, chart: string) => {
    if (!figure) { show(t.imageFail, "error"); return false; }
    try {
      await exportFigure(figure, `${name}-${chart}`);
      return true;
    } catch {
      show(t.imageFail, "error");
      return false;
    }
  }, [name, show, t.imageFail]);

  const downloadAll = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const buttons = [...document.querySelectorAll<HTMLElement>("[data-report-root] [data-chart-image]")];
      let done = 0;
      for (const b of buttons) {
        if (await downloadOne(b.closest("figure"), b.dataset.chart ?? `chart-${done + 1}`)) done += 1;
        await new Promise((r) => setTimeout(r, GAP_MS));
      }
      if (done > 0) show(fill(t.allDone, { n: done }));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [downloadOne, show, t.allDone]);

  const value = useMemo<Ctx>(() => ({ lang, name, busy, downloadOne, downloadAll, print: () => window.print() }), [lang, name, busy, downloadOne, downloadAll]);
  return <ReportContext.Provider value={value}>{children}{node}</ReportContext.Provider>;
}
