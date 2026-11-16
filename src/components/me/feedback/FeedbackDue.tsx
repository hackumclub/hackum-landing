import Image from "next/image";
import Link from "next/link";
import { MessageSquareHeart } from "lucide-react";
import { fill, tf, type Locale } from "@/i18n/config";
import { countdown } from "@/lib/me/queries";
import type { FeedbackCardState, FeedbackDueItem } from "@/lib/me/feedback-due";
import { buttonClass } from "@/components/ui/Button";
import Icon3D from "@/components/Icon3D";
import { pill } from "../pill";
import { feedbackCopy } from "./copy";

/**
 * Home: one card per finished event the person may still answer: poster thumb, title, when the survey closes and a one-tap
 * button. The survey that closes first comes first. Renders nothing when there is nothing to ask.
 */
export function FeedbackDueList({ items, lang, now }: { items: FeedbackDueItem[]; lang: Locale; now: Date }) {
  const c = feedbackCopy[lang];
  return (
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
      {items.map((it) => {
        const title = tf(it.title, lang);
        // `countdown` reads a start and an end; the closing time is both.
        const when = countdown({ starts_at: it.closesAt, ends_at: it.closesAt }, now, lang).text;
        return (
          <li key={it.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-[var(--radius-md)] border border-line bg-panel p-3 sm:p-4" style={{ background: "radial-gradient(120% 140% at 0% 0%, var(--ops-warn-soft), var(--ops-panel) 70%)" }}>
            <div aria-hidden="true" className="relative size-[4.5rem] overflow-hidden rounded-[var(--radius-sm)] border border-line bg-[radial-gradient(90%_90%_at_80%_10%,var(--ops-accent-soft),var(--ops-ember-soft))]">
              {it.cover ? <Image src={it.cover} alt="" fill sizes="72px" className="object-contain" /> : <Icon3D name="ticket" sizes="72px" className="absolute inset-2 size-14 rotate-6" />}
            </div>
            <div className="grid min-w-0 gap-0.5">
              <p className="font-bold text-fg [overflow-wrap:anywhere]">{title}</p>
              <p className="text-sm text-fg-muted">{when ? fill(c.dueClosesIn, { when }) : ""}</p>
            </div>
            <Link href={`/${lang}/me/events/${it.slug}/feedback`} aria-label={fill(c.dueFor, { title })} className={buttonClass("primary", "lg", "col-span-2 w-full")}>
              <MessageSquareHeart aria-hidden="true" size={18} />{c.give}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Past tab card: "Give feedback" / "Edit feedback" while the survey is open, a quiet thank-you once it has closed. */
export function FeedbackCardAction({ state, slug, title, lang }: { state: FeedbackCardState; slug: string; title: string; lang: Locale }) {
  if (!state) return null;
  const c = feedbackCopy[lang];
  if (state === "thanks") return <p className="text-sm text-fg-muted">{c.thanks}</p>;
  return (
    <div className="flex flex-wrap items-start gap-2">
      <Link href={`/${lang}/me/events/${slug}/feedback`} aria-label={fill(state === "give" ? c.dueFor : c.editFor, { title })} className={pill.soft}>
        <MessageSquareHeart aria-hidden="true" size={18} className="shrink-0 text-accent-fg" />{state === "give" ? c.give : c.edit}
      </Link>
    </div>
  );
}
