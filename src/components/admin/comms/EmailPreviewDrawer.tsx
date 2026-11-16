"use client";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState } from "react";
import Drawer from "@/components/ui/Drawer";
import Field, { Select } from "@/components/ui/Field";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import type { Locale } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { previewNotificationAction, type EmailPreview } from "@/lib/members/actions";
import { formatUb } from "@/lib/time";
import { errorText } from "@/components/admin/members/shared";

type State = { kind: "loading" } | { kind: "error"; text: string } | { kind: "ready"; data: EmailPreview };
const TAB = "inline-flex min-h-9 cursor-pointer items-center border-b-2 px-3 text-sm font-semibold whitespace-nowrap border-transparent text-fg-muted hover:text-fg data-[state=active]:border-accent data-[state=active]:text-fg";

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
  const fmt = (iso: string) => formatUb(new Date(iso), lang, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="grid gap-4">
      <Field label={t.language}>
        {(ctl) => (
          <Select {...ctl} value={previewLang ?? lang} onChange={(e) => { const l = e.target.value === "en" ? "en" : "mn"; setPreviewLang(l); reload(l); }} className="max-w-48">
            <option value="mn">Монгол</option>
            <option value="en">English</option>
          </Select>
        )}
      </Field>

      {state.kind === "loading" && (
        <div role="status" className="grid gap-2"><span className="sr-only">{t.loading}</span><Skeleton className="h-6 w-2/3" /><Skeleton className="h-72" /></div>
      )}
      {state.kind === "error" && (
        <div role="alert" className="grid justify-items-start gap-2 rounded-[var(--radius-md)] border border-line bg-danger-soft p-3 text-sm text-danger-fg">
          <p className="font-semibold">{state.text}</p>
          <Button size="sm" variant="secondary" onClick={() => reload(previewLang)}>{common.retry}</Button>
        </div>
      )}
      {data && (
        <>
          <dl className="grid gap-1 text-sm">
            <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"><dt className="text-fg-muted">{t.subject}</dt><dd data-testid="preview-subject" className="font-semibold break-words text-fg">{data.subject}</dd></div>
            <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"><dt className="text-fg-muted">{t.recipient}</dt><dd className="break-words text-fg">{data.recipient || common.empty}</dd></div>
          </dl>
          <Tabs.Root defaultValue="email" className="grid gap-3">
            <Tabs.List aria-label={t.tabs.label} className="flex gap-1 border-b border-line">
              <Tabs.Trigger value="email" className={TAB}>{t.tabs.email}</Tabs.Trigger>
              <Tabs.Trigger value="text" className={TAB}>{t.tabs.text}</Tabs.Trigger>
              <Tabs.Trigger value="invite" className={TAB}>{t.tabs.invite}</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="email">
              <iframe title={t.frame} sandbox="" srcDoc={data.html} className="h-[32rem] w-full rounded-[var(--radius-sm)] border border-line bg-panel" />
            </Tabs.Content>
            <Tabs.Content value="text">
              <pre className="max-h-[32rem] overflow-auto rounded-[var(--radius-sm)] border border-line bg-panel-2 p-3 font-sans text-sm leading-relaxed break-words whitespace-pre-wrap text-fg">{data.text}</pre>
            </Tabs.Content>
            <Tabs.Content value="invite" className="grid gap-2">
              {data.invite ? (
                <>
                  <p className="text-sm text-fg-muted">{t.inviteLead}</p>
                  <dl className="grid gap-1.5 text-sm">
                    {([
                      [t.inviteMethod, t.methods[data.invite.method]],
                      [t.inviteTitle, data.invite.title],
                      [t.inviteStarts, fmt(data.invite.start)],
                      [t.inviteEnds, fmt(data.invite.end)],
                      [t.inviteLocation, data.invite.location || common.empty],
                      [t.inviteSequence, String(data.invite.sequence)],
                    ] as const).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2"><dt className="text-fg-muted">{k}</dt><dd className="break-words text-fg">{v}</dd></div>
                    ))}
                  </dl>
                </>
              ) : <p className="text-sm text-fg-muted">{t.noInvite}</p>}
            </Tabs.Content>
          </Tabs.Root>
        </>
      )}
    </div>
  );
}
