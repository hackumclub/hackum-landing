import type { ReactNode } from "react";
import Sticker from "@/components/Sticker";
import { tf, type Locale } from "@/i18n/config";
import PresentationPanel from "./PresentationPanel";
import { SLIDES } from "./slides";

/**
 * Split screen for sign-in and join: a clean form card on the left, the presentation on the right from lg. Below lg the
 * panel collapses to a short banner above the form. Light-only, like the rest of the public site (ops tokens forced light).
 */
export default function AuthShell({ lang, children, banner, wide = false }: { lang: Locale; children: ReactNode; banner?: ReactNode; wide?: boolean }) {
  const first = SLIDES[0];
  return (
    <div className="ops ops-canvas mx-2 mt-2 mb-6 rounded-[40px] p-3 md:mx-4 md:p-4" data-theme="light">
      <div className={wide ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]"}>
        <div className="grid content-start gap-4">
          <div data-stage className="ops-stage flex items-center gap-4 px-5 py-4 lg:hidden">
            <Sticker name={first.sticker} sizes="80px" className="w-16 shrink-0 -rotate-3" />
            <p className="font-display text-lg leading-tight font-black [overflow-wrap:anywhere]">{banner ?? tf(first.title, lang)}</p>
          </div>
          <div className={wide ? "mx-auto w-full max-w-[600px]" : "mx-auto w-full max-w-[440px]"}>{children}</div>
        </div>
        <PresentationPanel lang={lang} className="hidden lg:flex lg:min-h-[34rem]" />
      </div>
    </div>
  );
}

