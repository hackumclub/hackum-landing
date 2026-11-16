"use client";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import BilingualField from "@/components/ui/BilingualField";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Skeleton from "@/components/ui/Skeleton";
import { fill, href, tf, type L, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { plural } from "@/i18n/plural";
import { sendAnnouncementAction } from "@/lib/announce/actions";
import {
  BODY_MAX, NO_AUDIENCE, SUBJECT_MAX, parseDraft, sendBlock, serializeDraft, toAudience,
  type AudienceChoice, type AudienceKind, type AudienceSize,
} from "@/lib/announce/compose-state";
import { copy } from "@/lib/announce/copy";
import { announceMessage } from "@/lib/announce/errors";
import AudienceCards, { type EventOption, type SizeStates } from "./AudienceCards";
import PreviewPanel from "./PreviewPanel";
import SendBar from "./SendBar";
import { useAudienceSize } from "./useAudienceSize";

const DRAFT_KEY = "hackum:announce-draft:v1";
const SAVE_MS = 400;
const readDraft = () => { try { return parseDraft(localStorage.getItem(DRAFT_KEY)); } catch { return null; } };
const writeDraft = (v: string | null) => { try { if (v === null) localStorage.removeItem(DRAFT_KEY); else localStorage.setItem(DRAFT_KEY, v); } catch { /* storage blocked: the draft just is not saved */ } };

const noop = () => () => {};
/** False while rendering on the server and during hydration, true afterwards (the draft lives in the browser only). */
const useIsClient = () => useSyncExternalStore(noop, () => true, () => false);

type Plan = { perDay: number; reserved: number };
type Props = { lang: Locale; events: EventOption[]; initialAudience: AudienceChoice; plan: Plan };
type Sent = { queued: number; optedOut: number; days: number };

export default function Composer(props: Props) {
  return useIsClient() ? <Form {...props} /> : <FormSkeleton label={copy[props.lang].preview.loading} />;
}

export function FormSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <span className="sr-only">{label}</span>
      <div className="grid gap-6"><Skeleton className="h-[26rem] rounded-[var(--radius-md)]" /><Skeleton className="h-[26rem] rounded-[var(--radius-md)]" /></div>
      <Skeleton className="h-[34rem] rounded-[var(--radius-md)]" />
    </div>
  );
}

const EMPTY: L = { mn: "", en: "" };

function Form({ lang, events, initialAudience, plan }: Props) {
  const t = copy[lang];
  const d = getDictionary(lang);
  // Read once, at the first client render: the draft is the starting point, a link's ?audience wins over the saved audience.
  const [draft] = useState(readDraft);
  const [subject, setSubject] = useState<L>(draft?.subject ?? EMPTY);
  const [body, setBody] = useState<L>(draft?.body ?? EMPTY);
  const [choice, setChoice] = useState<AudienceChoice>(initialAudience.kind ? initialAudience : draft?.audience ?? NO_AUDIENCE);
  const [restored, setRestored] = useState(!!draft && (draft.subject.mn !== "" || draft.body.mn !== "" || draft.subject.en !== "" || draft.body.en !== ""));
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Sent | null>(null);
  const [sentSnap, setSentSnap] = useState<string | null>(null);
  const sendingRef = useRef(false);

  const snapshot = JSON.stringify([subject, body, choice]);
  const sent = sentSnap !== null && sentSnap === snapshot;

  const states: SizeStates = {
    members: useAudienceSize({ kind: "members" }),
    community: useAudienceSize({ kind: "community" }),
    everyone: useAudienceSize({ kind: "everyone" }),
    subscribers: useAudienceSize({ kind: "subscribers" }),
    event: useAudienceSize(toAudience({ ...choice, kind: "event" })),
  };
  const current = choice.kind ? states[choice.kind] : null;
  const size: AudienceSize | null = current?.status === "ready" ? current.size : null;
  const reason = sendBlock({ subject: subject.mn, body: body.mn, subjectEn: subject.en, bodyEn: body.en, audience: choice, size, sent });

  // Draft autosave (debounced). A message that has just been sent is not a draft any more.
  useEffect(() => {
    if (sent) return;
    const empty = !subject.mn && !subject.en && !body.mn && !body.en && !choice.kind;
    const timer = setTimeout(() => writeDraft(empty ? null : serializeDraft({ subject, body, audience: choice })), SAVE_MS);
    return () => clearTimeout(timer);
  }, [subject, body, choice, sent]);

  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setError(null); setRestored(false); };

  const send = async () => {
    const audience = toAudience(choice);
    if (sendingRef.current || reason !== null || !audience) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    try {
      // The same `key` is used for every retry of this message, so a retry after a dropped connection never mails twice.
      const r = await sendAnnouncementAction({ key, audience, subject, body });
      if (!r.ok) { setError(announceMessage(r.error, lang)); return; }
      writeDraft(null);
      setRestored(false);
      setKey(crypto.randomUUID());
      setSentSnap(snapshot);
      setToast(r.data);
    } catch {
      setError(announceMessage("network", lang));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const reset = () => {
    writeDraft(null);
    setSubject(EMPTY); setBody(EMPTY); setChoice(NO_AUDIENCE);
    setSentSnap(null); setToast(null); setError(null); setRestored(false);
    setKey(crypto.randomUUID());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chosen: AudienceKind | null = choice.kind;
  const eventTitle = tf(events.find((e) => e.id === choice.eventId)?.title ?? EMPTY, lang);
  const counter = (l: L, max: number) => (
    <p className="tnum -mt-1 flex flex-wrap gap-x-4 text-sm text-fg-muted">
      {(["mn", "en"] as const).map((k) => (
        <span key={k} className={l[k].length > max ? "font-semibold text-danger-fg" : undefined}>
          {d.ui.bilingual[k]}: {fill(t.what.counter, { n: l[k].length, max })}{l[k].length > max && ` · ${fill(t.what.tooLong, { n: l[k].length, max })}`}
        </span>
      ))}
    </p>
  );
  const tooLong = (v: string, max: number) => (v.length > max ? fill(t.what.tooLong, { n: v.length, max }) : undefined);
  const section = "grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 shadow-[var(--shadow-soft)] md:p-5";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <div className="grid min-w-0 gap-6">
        {restored && (
          <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-line bg-accent-soft px-4 py-2.5 text-sm font-semibold text-accent-fg">
            <span>{t.send.draftRestored}</span>
            <Button variant="ghost" size="sm" onClick={reset}>{t.send.discard}</Button>
          </div>
        )}
        <section aria-labelledby="who-h" className={section}>
          <div className="grid gap-1">
            <h2 id="who-h" className="font-display text-xl font-bold text-fg">{t.who.title}</h2>
            <p className="text-sm text-fg-muted">{t.who.line}</p>
          </div>
          <AudienceCards lang={lang} choice={choice} onChange={edit(setChoice)} events={events} states={states} />
        </section>

        <section aria-labelledby="what-h" className={section}>
          <div className="grid gap-1">
            <h2 id="what-h" className="font-display text-xl font-bold text-fg">{t.what.title}</h2>
            <p className="text-sm text-fg-muted">{t.what.line}</p>
          </div>
          <BilingualField name="subject" label={t.what.subject} value={subject} onChange={edit(setSubject)} labels={d.ui.bilingual} error={tooLong(subject.mn, SUBJECT_MAX)} />
          {counter(subject, SUBJECT_MAX)}
          <div className="grid gap-4 [&_textarea]:min-h-56">
            <BilingualField name="body" label={t.what.body} value={body} onChange={edit(setBody)} labels={d.ui.bilingual} multiline error={tooLong(body.mn, BODY_MAX)} />
            <p className="-mt-3 text-sm text-fg-muted">{t.what.bodyHint}</p>
            {counter(body, BODY_MAX)}
          </div>
        </section>
      </div>

      <PreviewPanel lang={lang} subject={subject} body={body} />

      <div className="grid gap-3 lg:col-span-2">
        {error && <p role="alert" className="rounded-[var(--radius-md)] border border-danger-fg bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-fg">{error}</p>}
        <SendBar
          lang={lang} reason={reason} subject={tf(subject, lang)} kind={chosen} eventTitle={eventTitle}
          audienceLabel={chosen ? t.who.cards[chosen].title : ""} willReceive={size?.willReceive ?? 0} optedOut={size?.optedOut ?? 0}
          plan={plan} enMissing={subject.en.trim() === "" || body.en.trim() === ""} sending={sending} onConfirm={send}
        />
      </div>

      <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
        {toast && (
          <div data-testid="sent-toast" className="pointer-events-auto flex max-w-lg items-start gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-4 py-3 text-sm shadow-[var(--shadow-card)]">
            <CheckCircle2 aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-ok-fg" />
            <div className="grid min-w-0 flex-1 gap-2">
              <p className="font-semibold text-fg">
                {toast.queued === 0 ? t.send.doneNothing : [
                  plural(lang, toast.queued, t.send.done),
                  toast.days > 1 ? fill(t.send.doneDays, { days: toast.days }) : "",
                  toast.optedOut > 0 ? fill(t.send.doneSkipped, { n: toast.optedOut }) : "",
                ].filter(Boolean).join(" ")}
              </p>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link href={`${href(lang, "/admin/comms")}?template=announcement`} className="min-h-8 font-bold text-accent-fg underline underline-offset-2">{t.send.viewComms}</Link>
                <button type="button" onClick={reset} className="min-h-8 cursor-pointer font-bold text-accent-fg underline underline-offset-2">{t.send.another}</button>
              </p>
            </div>
            <IconButton size="sm" label={t.send.close} icon={<X size={14} />} onClick={() => setToast(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
