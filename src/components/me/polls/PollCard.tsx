"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Clock, EyeOff, Eye, Users } from "lucide-react";
import { fill, tf, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { PollCardVm } from "@/lib/me/poll-view";
import { votePollAction } from "@/lib/me/poll-actions";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { cx } from "@/components/ui/cx";
import { pill } from "../pill";
import { useToast } from "../Toast";
import { pollsCopy, type PollsCopy } from "./copy";

/** One option row: a 48 px target with a visible box/dot, so "chosen" is a mark and a border, never colour alone. */
function Choice({ type, name, value, label, checked, disabled, describedBy, onChange }: {
  type: "radio" | "checkbox"; name: string; value: string; label: string; checked: boolean; disabled: boolean; describedBy?: string; onChange: () => void;
}) {
  return (
    <label className={cx(
      "flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] border-2 px-4 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
      checked ? "border-accent bg-accent-soft" : "border-line bg-panel-2",
      disabled ? "cursor-not-allowed opacity-60" : cx("cursor-pointer", !checked && "hover:bg-neutral-soft"),
    )}>
      <input type={type} name={name} value={value} checked={checked} disabled={disabled} aria-describedby={disabled ? describedBy : undefined} onChange={onChange} className="sr-only" />
      <span aria-hidden="true" className={cx("grid size-6 shrink-0 place-items-center border-2", type === "checkbox" ? "rounded-md" : "rounded-full", checked ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-panel")}>
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="font-semibold text-fg [overflow-wrap:anywhere]">{label}</span>
    </label>
  );
}

/** Option bars: label, "12 votes · 38%" as text, your own choice tagged "Your vote". The bar is decoration for numbers already written. */
function Results({ vm, lang, c, mine }: { vm: PollCardVm; lang: Locale; c: PollsCopy; mine: string[] }) {
  const tallies = new Map((vm.tallies ?? []).map((t) => [t.option_id, t.votes]));
  return (
    <ul className="grid gap-3.5">
      {vm.options.map((o) => {
        const votes = tallies.get(o.id) ?? 0;
        const pct = vm.voters > 0 ? Math.round((votes / vm.voters) * 100) : 0;
        const own = mine.includes(o.id);
        return (
          <li key={o.id} className="grid gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold text-fg [overflow-wrap:anywhere]">{tf(o.label, lang)}{own && <Tag tone="accent" icon={Check}>{c.yourVote}</Tag>}</span>
              <span className="tnum shrink-0 text-sm font-bold text-fg">{plural(lang, votes, c.votesCount)} · {pct}%</span>
            </div>
            <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-neutral-soft">
              <div className={cx("h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none", own ? "bg-c1" : "bg-c5")} style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A poll: title, audience, when it closes, then what the person can do now: vote (radio group for one choice, checkbox group
 * with a visible limit for several), see the bars once the poll's rule allows it, or read why the numbers are not shown yet.
 * Voting again changes the same ballot until the poll closes.
 */
export default function PollCard({ vm, lang, timeLine }: { vm: PollCardVm; lang: Locale; timeLine: string }) {
  const c = pollsCopy[lang];
  const router = useRouter();
  const toast = useToast();
  const [mine, setMine] = useState<string[] | null>(vm.myVote);
  const [editing, setEditing] = useState(vm.state === "open" && vm.myVote === null);
  const [picked, setPicked] = useState<string[]>(vm.myVote ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const max = vm.multi ? vm.maxChoices : 1;
  const full = vm.multi && picked.length >= max;
  const limitId = `limit-${vm.id}`;
  const title = tf(vm.title, lang);
  const desc = tf(vm.description, lang).trim();
  const showBars = vm.visible && !editing;

  const toggle = (id: string) => setPicked((p) => (vm.multi ? (p.includes(id) ? p.filter((x) => x !== id) : p.length < max ? [...p, id] : p) : [id]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (picked.length === 0) return;
    setError(null);
    start(async () => {
      const r = await votePollAction(lang, { pollId: vm.id, optionIds: picked });
      if (r.ok) { setMine(picked); setEditing(false); toast(c.saved); router.refresh(); }
      else setError(r.message);
    });
  }

  const hiddenText = vm.hidden === "after_vote" ? c.hiddenAfterVote : vm.hidden === "after_close" ? c.hiddenAfterClose : vm.hidden === "staff_only" ? c.hiddenStaffOnly : null;
  const votedHidden = vm.hidden === "staff_only" ? c.votedHiddenStaffOnly : c.votedHiddenAfterClose;

  return (
    <article aria-labelledby={`poll-${vm.id}`} className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <header className="grid gap-2">
        <h2 id={`poll-${vm.id}`} className="font-display text-lg leading-snug font-bold text-fg [overflow-wrap:anywhere]">{title}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Tag tone="accent" icon={Users}>{c.audience[vm.audience]}</Tag>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted"><Clock aria-hidden="true" size={16} className="shrink-0" />{timeLine}</span>
        </div>
        {desc && <p className="text-sm text-fg-muted [overflow-wrap:anywhere]">{desc}</p>}
      </header>

      {vm.state === "open" && editing && (
        <form onSubmit={submit} className="grid gap-3">
          <fieldset role={vm.multi ? undefined : "radiogroup"} className="grid min-w-0 gap-2">
            <legend className="mb-1 text-sm font-semibold text-fg">
              {vm.multi ? fill(c.chooseUpTo, { max }) : c.chooseOne}
              {vm.multi && <span className="ml-2 font-normal text-fg-muted tnum">{fill(c.chosenCount, { n: picked.length, max })}</span>}
            </legend>
            {vm.options.map((o) => {
              const checked = picked.includes(o.id);
              return <Choice key={o.id} type={vm.multi ? "checkbox" : "radio"} name={`poll-${vm.id}`} value={o.id} label={tf(o.label, lang)} checked={checked} disabled={vm.multi && full && !checked} describedBy={limitId} onChange={() => toggle(o.id)} />;
            })}
          </fieldset>
          <p id={limitId} aria-live="polite" className="min-h-0 text-sm font-semibold text-ember-fg empty:hidden">{full ? fill(c.limitReached, { max }) : ""}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="lg" disabled={pending || picked.length === 0} aria-busy={pending}>{pending ? c.voting : mine ? c.change : c.vote}</Button>
            {mine && <button type="button" className={pill.soft} onClick={() => { setPicked(mine); setEditing(false); setError(null); }}>{c.cancelChange}</button>}
          </div>
          <p role="alert" className="text-sm font-bold text-danger-fg empty:hidden">{error}</p>
        </form>
      )}

      {showBars && (
        <div className="grid gap-3">
          <Results vm={vm} lang={lang} c={c} mine={mine ?? []} />
          {vm.multi && <p className="text-xs text-fg-muted">{c.pctNote}</p>}
        </div>
      )}

      {!editing && !showBars && vm.state !== "scheduled" && (
        <p className="flex items-start gap-2 rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2.5 text-sm font-semibold text-fg">
          {mine ? <Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-ok-fg" /> : <Eye aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-fg-muted" />}
          {mine ? votedHidden : vm.state === "closed" ? `${c.noVoteClosed} ${hiddenText ?? ""}`.trim() : hiddenText}
        </p>
      )}

      {vm.state === "open" && editing && !vm.visible && hiddenText && !mine && <p className="flex items-center gap-2 text-sm text-fg-muted"><Eye aria-hidden="true" size={16} className="shrink-0" />{hiddenText}</p>}

      {vm.state === "open" && !editing && (
        <div><button type="button" className={pill.soft} onClick={() => { setPicked(mine ?? []); setEditing(true); }}>{c.change}</button></div>
      )}

      {vm.state !== "scheduled" && (
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line pt-3 text-sm text-fg-muted">
          {vm.visible && vm.turnout !== null && <span className="tnum font-semibold text-fg">{fill(c.turnout, { voted: vm.voters, eligible: vm.eligible })}</span>}
          {(mine || editing) && <span className="inline-flex items-center gap-1.5">{vm.anonymous ? <EyeOff aria-hidden="true" size={16} className="shrink-0" /> : <Eye aria-hidden="true" size={16} className="shrink-0" />}{vm.anonymous ? c.anonymous : c.named}</span>}
        </footer>
      )}
    </article>
  );
}
