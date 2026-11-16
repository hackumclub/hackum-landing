"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { fill, type Locale } from "@/i18n/config";
import Button, { ButtonLink } from "@/components/ui/Button";
import Field, { Textarea } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import Sticker from "@/components/Sticker";
import { submitFeedbackAction } from "@/lib/me/feedback-actions";
import { pill } from "../pill";
import { StickyBar } from "../parts";
import { useToast } from "../Toast";
import type { FeedbackCopy } from "./copy";
import { NpsScale, StarRating } from "./RadioScale";
import Switch from "./Switch";

const MAX = 1000;
export type FeedbackAnswer = { rating: number; nps: number; went_well: string; improve: string; anonymous: boolean };

/**
 * The after-event survey: rating, recommend score, two optional comments and the "without my name" switch (on by default).
 * Submitting again edits the same answer. On success the form is replaced by a thank-you with the next step; "Edit my answer"
 * brings it back. Every failure shows a sentence next to the button, never a code.
 */
export default function FeedbackForm({ lang, eventId, c, initial, closesText }: { lang: Locale; eventId: string; c: FeedbackCopy; initial: FeedbackAnswer | null; closesText: string }) {
  const router = useRouter();
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const thanks = useRef<HTMLHeadingElement>(null);
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [nps, setNps] = useState<number | null>(initial?.nps ?? null);
  const [well, setWell] = useState(initial?.went_well ?? "");
  const [improve, setImprove] = useState(initial?.improve ?? "");
  const [anonymous, setAnonymous] = useState(initial?.anonymous ?? true);
  const [errors, setErrors] = useState<{ rating?: string; nps?: string }>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(initial !== null);
  const [done, setDone] = useState<"sent" | "updated" | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    const next = { ...(rating === null ? { rating: c.errRating } : {}), ...(nps === null ? { nps: c.errNps } : {}) };
    setErrors(next);
    if (rating === null || nps === null) {
      form.current?.querySelector<HTMLElement>(rating === null ? 'input[name="rating"]' : 'input[name="nps"]')?.focus();
      return;
    }
    start(async () => {
      const r = await submitFeedbackAction(lang, { eventId, rating, nps, went_well: well, improve, anonymous });
      if (r.ok) {
        setDone(answered ? "updated" : "sent");
        setAnswered(true);
        toast(c.doneTitle);
        router.refresh();
        // Move focus to the thank-you once it has rendered, so keyboard and screen-reader users land on it.
        setTimeout(() => thanks.current?.focus(), 0);
      } else setTopError(r.message);
    });
  }

  if (done) {
    return (
      <div role="status" className="grid justify-items-center gap-3 rounded-[var(--radius-md)] border border-line bg-panel px-6 py-10 text-center" style={{ background: "radial-gradient(120% 140% at 50% 0%, var(--ops-ok-soft), var(--ops-panel) 70%)" }}>
        <Sticker name="feedback" className="w-28" sizes="112px" />
        <h2 ref={thanks} tabIndex={-1} className="font-display text-2xl font-black text-fg outline-none">{c.doneTitle}</h2>
        <p className="max-w-sm text-sm text-fg-muted">{done === "updated" ? c.doneUpdated : c.doneLine}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <ButtonLink href={`/${lang}/me/events`} size="lg">{c.browse}</ButtonLink>
          <button type="button" className={pill.soft} onClick={() => setDone(null)}><Pencil aria-hidden="true" size={16} />{c.editAgain}</button>
        </div>
      </div>
    );
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="grid gap-6 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-6">
      {initial && <p className="rounded-[var(--radius-sm)] bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-fg">{fill(c.editHint, { date: closesText })}</p>}

      <StarRating name="rating" value={rating} onChange={(n) => { setRating(n); setErrors((x) => ({ ...x, rating: undefined })); }} label={c.ratingLabel} required error={errors.rating}
        words={c.ratingWords} starLabel={c.starLabel} chosen={c.ratingChosen} none={c.ratingNone} />

      <NpsScale name="nps" value={nps} onChange={(n) => { setNps(n); setErrors((x) => ({ ...x, nps: undefined })); }} label={c.npsLabel} required error={errors.nps}
        option={c.npsOption} low={c.npsLow} high={c.npsHigh} chosen={c.npsChosen} none={c.npsNone} />

      <Field label={<>{c.wellLabel} <span className="font-normal text-fg-muted">({c.optional})</span></>}
        hint={<span className={cx("tnum", well.length >= MAX && "font-bold text-fg")}>{fill(c.counter, { n: well.length, max: MAX })}</span>}>
        {(ctl) => <Textarea {...ctl} name="went_well" rows={4} maxLength={MAX} value={well} onChange={(e) => setWell(e.target.value)} />}
      </Field>
      <Field label={<>{c.improveLabel} <span className="font-normal text-fg-muted">({c.optional})</span></>}
        hint={<span className={cx("tnum", improve.length >= MAX && "font-bold text-fg")}>{fill(c.counter, { n: improve.length, max: MAX })}</span>}>
        {(ctl) => <Textarea {...ctl} name="improve" rows={4} maxLength={MAX} value={improve} onChange={(e) => setImprove(e.target.value)} />}
      </Field>

      <Switch label={c.anonLabel} line={anonymous ? c.anonOn : c.anonOff} checked={anonymous} onChange={setAnonymous} />

      <p role="alert" className="text-sm font-bold text-danger-fg empty:hidden">{topError}</p>
      <StickyBar aboveTabs label={c.submit}>
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending} className="min-h-12 flex-1 text-lg md:flex-none md:px-10">{pending ? c.sending : answered ? c.update : c.submit}</Button>
        <Link href={`/${lang}/me/events?tab=past`} className={cx(pill.soft, "max-md:hidden")}>{c.back}</Link>
      </StickyBar>
    </form>
  );
}
