"use client";
import { useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import SegmentedChoice from "@/components/ui/SegmentedChoice";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { previewNotificationAction, type EmailPreview } from "@/lib/members/actions";
import { formatUbStable } from "@/lib/time";
import { errorText } from "@/components/admin/members/shared";

type State = { kind: "loading" } | { kind: "error"; text: string } | { kind: "ready"; data: EmailPreview };
type Tab = "email" | "text" | "invite";

type Common = AreaCopy["common"];
type Shared = { lang: Locale; c: AreaCopy["comms"]; common: Common };

/**
 * Renders the real email for a queued/sent notification. The HTML goes into a sandboxed iframe (no scripts, no forms,
 * no top navigation), so nothing in a payload can run in the admin origin even if the template had a bug.
 */
export default function EmailPreviewDrawer({ id, title, lang, c, common, closeLabel, onClose }: Shared & {
  id: string | null; title: string; closeLabel: string; onClose: () => void;
}) {
  return (
    <Drawer open={id !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={c.drawer.title} description={title || c.drawer.description} closeLabel={closeLabel}>
      {/* Keyed by id: each opened email starts from a clean "loading" state, with no reset effect needed. */}
      {id && <PreviewBody key={id} id={id} lang={lang} c={c} common={common} />}
    </Drawer>
  );
}

function PreviewBody({ id, lang, c, common }: Shared & { id: string }) {
  const t = c.drawer;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [previewLang, setPreviewLang] = useState<Locale | null>(null);
  const [tab, setTab] = useState<Tab>("email");
  // Each change of `request` (first open, language switch, retry) triggers exactly one fetch below.
  const [request, setRequest] = useState<{ n: number; lang: Locale | null }>({ n: 0, lang: null });
  const reload = (chosen: Locale | null) => { setState({ kind: "loading" }); setRequest((r) => ({ n: r.n + 1, lang: chosen })); };

  useEffect(() => {
    let live = true; // a slow response for an earlier request must not overwrite a newer one
    previewNotificationAction(id, request.lang ?? undefined)
      .then((r) => {
        if (!live) return;
        if (r.ok) { setState({ kind: "ready", data: r.data }); setPreviewLang((l) => l ?? r.data.lang); }
        else setState({ kind: "error", text: errorText(common.errors, r.error) });
      })
      .catch(() => { if (live) setState({ kind: "error", text: t.failed }); });
    return () => { live = false; };
  }, [id, request, common.errors, t.failed]);

  const data = state.kind === "ready" ? state.data : null;
  const fmt = (iso: string) => formatUbStable(new Date(iso), lang, "datetime");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedChoice
          name="preview-language" ariaLabel={t.language} value={previewLang ?? lang}
          onChange={(l) => { setPreviewLang(l); reload(l); }}
          options={[{ value: "mn", label: "Монгол" }, { value: "en", label: "English" }]}
        />
        <SegmentedTabs
          ariaLabel={t.tabs.label} value={tab} onChange={(k) => setTab(k as Tab)} className="max-w-full"
          items={[{ key: "email", label: t.tabs.email }, { key: "text", label: t.tabs.text }, { key: "invite", label: t.tabs.invite }]}
        />
      </div>

      {state.kind === "loading" && (
        <div role="status" className="grid gap-2"><span className="sr-only">{t.loading}</span><Skeleton className="h-16" /><Skeleton className="h-[60dvh]" /></div>
      )}
      {state.kind === "error" && (
        <div role="alert" className="grid justify-items-start gap-2 rounded-[var(--radius-md)] border border-line bg-danger-soft p-3 text-sm text-danger-fg">
          <p className="font-semibold">{state.text}</p>
          <Button size="sm" variant="secondary" onClick={() => reload(previewLang)}>{common.retry}</Button>
        </div>
      )}
      {data && (
        <>
          <dl className="grid gap-x-6 gap-y-3 rounded-[var(--radius-sm)] bg-panel-2 p-3 text-sm sm:grid-cols-2">
            <div className="grid min-w-0 gap-0.5"><dt className="text-xs font-semibold text-fg-muted">{t.subject}</dt><dd data-testid="preview-subject" className="font-semibold break-words text-fg">{data.subject}</dd></div>
            <div className="grid min-w-0 gap-0.5"><dt className="text-xs font-semibold text-fg-muted">{t.recipient}</dt><dd className="break-words text-fg">{data.recipient || common.empty}</dd></div>
          </dl>
          <div role="tabpanel" aria-label={t.tabs[tab]}>
            {tab === "email" && (
              <iframe title={t.frame} sandbox="" srcDoc={data.html} className="block h-[min(36rem,70dvh)] min-h-[60dvh] w-full rounded-[var(--radius-md)] border border-line bg-[#f3f5f8] sm:h-[34rem] sm:min-h-0" />
            )}
            {tab === "text" && (
              <pre className="max-h-[min(40rem,70dvh)] overflow-auto rounded-[var(--radius-sm)] border border-line bg-panel-2 p-4 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-fg">{data.text}</pre>
            )}
            {tab === "invite" && (
              <div className="grid gap-3">
                {data.invite ? (
                  <>
                    <p className="text-sm text-fg-muted">{t.inviteLead}</p>
                    <dl className="grid gap-x-6 gap-y-3 rounded-[var(--radius-sm)] bg-panel-2 p-3 text-sm sm:grid-cols-2">
                      {([
                        [t.inviteMethod, t.methods[data.invite.method]],
                        [t.inviteTitle, data.invite.title],
                        [t.inviteStarts, fmt(data.invite.start)],
                        [t.inviteEnds, fmt(data.invite.end)],
                        [t.inviteLocation, data.invite.location || common.empty],
                        [t.inviteSequence, String(data.invite.sequence)],
                      ] as const).map(([k, v]) => (
                        <div key={k} className="grid min-w-0 gap-0.5"><dt className="text-xs font-semibold text-fg-muted">{k}</dt><dd className="break-words text-fg">{v}</dd></div>
                      ))}
                    </dl>
                  </>
                ) : <p className="text-sm text-fg-muted">{t.noInvite}</p>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
