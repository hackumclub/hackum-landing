"use client";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useId, useState } from "react";
import Button from "@/components/ui/Button";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import Skeleton from "@/components/ui/Skeleton";
import { cx } from "@/components/ui/cx";
import type { L, Locale } from "@/i18n/config";
import { previewAnnouncementAction } from "@/lib/announce/actions";
import { copy } from "@/lib/announce/copy";

type State = { key: string; kind: "ready"; subject: string; html: string } | { key: string; kind: "error" };

const DEBOUNCE_MS = 300;

/**
 * The real rendered email in a sandboxed iframe (`sandbox=""`: no scripts, no forms, no navigation), rendered on the
 * server from what is typed (debounced 300 ms). Stale answers are ignored. Sticky from lg, collapsible on phones.
 */
export default function PreviewPanel({ lang, subject, body }: { lang: Locale; subject: L; body: L }) {
  const t = copy[lang].preview;
  const [previewLang, setPreviewLang] = useState<Locale>(lang);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const [state, setState] = useState<State | null>(null);
  const empty = subject.mn.trim() === "" && subject.en.trim() === "" && body.mn.trim() === "" && body.en.trim() === "";
  const key = JSON.stringify([subject, body, previewLang]);

  useEffect(() => {
    if (empty) return;
    let live = true;
    const timer = setTimeout(() => {
      previewAnnouncementAction({ subject, body, lang: previewLang })
        .then((r) => { if (live) setState(r.ok ? { key, kind: "ready", subject: r.data.subject, html: r.data.html } : { key, kind: "error" }); })
        .catch(() => { if (live) setState({ key, kind: "error" }); });
    }, DEBOUNCE_MS);
    return () => { live = false; clearTimeout(timer); };
    // `key` encodes subject, body and language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, empty]);

  const fresh = state && state.key === key ? state : null;
  const shown = state && state.kind === "ready" ? state : null; // keep the last good email on screen while the next one loads
  const fallback = previewLang === "en" && (subject.en.trim() === "" || body.en.trim() === "") && !empty;

  return (
    <aside aria-label={t.title} className="grid content-start gap-3 lg:sticky lg:top-24">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="min-w-0 font-display text-lg font-bold text-fg [overflow-wrap:anywhere]">{t.title}</h2>
        <Button variant="secondary" size="sm" className="lg:hidden" aria-expanded={open} aria-controls={panelId} icon={open ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />} onClick={() => setOpen((o) => !o)}>
          {open ? t.hide : t.show}
        </Button>
      </div>
      <div id={panelId} className={cx("grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 shadow-[var(--shadow-soft)]", !open && "max-lg:hidden")}>
        <SegmentedTabs ariaLabel={t.language} value={previewLang} onChange={(k) => setPreviewLang(k === "en" ? "en" : "mn")} items={[{ key: "mn", label: "Монгол" }, { key: "en", label: "English" }]} />
        {empty ? (
          <p className="rounded-[var(--radius-sm)] bg-panel-2 p-4 text-sm text-fg-muted">{t.empty}</p>
        ) : (
          <>
            <p className="text-sm [overflow-wrap:anywhere]" data-testid="preview-subject">
              <span className="font-semibold text-fg-muted">{t.subjectLabel}: </span>
              <span className="font-bold text-fg">{shown?.subject ?? ""}</span>
            </p>
            {fallback && <p className="text-sm text-fg-muted">{t.enFallback}</p>}
            {state?.kind === "error" && <p role="alert" className="text-sm font-semibold text-danger-fg">{t.failed}</p>}
            <div className="relative">
              {shown ? (
                <iframe title={t.frameTitle} sandbox="" srcDoc={shown.html} className="h-[30rem] w-full rounded-[var(--radius-sm)] border border-line bg-white" data-testid="preview-frame" />
              ) : (
                <Skeleton className="h-[30rem] rounded-[var(--radius-sm)]" />
              )}
              {!fresh && shown && <span role="status" className="sr-only">{t.loading}</span>}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
