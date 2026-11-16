"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { MeCopy } from "@/i18n/areas/me";
import { fill } from "@/i18n/config";
import { applyForMembershipAction } from "@/lib/me/actions";
import { useToast } from "./Toast";
import Button from "@/components/ui/Button";
import Icon3D from "@/components/Icon3D";
import Field, { Textarea } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { useFocusFirstError } from "./focus";
import { StickyBar } from "./parts";

export const TEAM_KEYS = ["Marketing", "Dev", "Design", "Events", "Content", "Mentors"] as const;
const MIN = 10;
const MAX = 1000;

/** Membership application: motivation (10–1000 chars, live counter) and the teams they are drawn to. */
export default function MembershipForm({ c, errors }: { c: MeCopy["membership"]; errors: Record<string, string> }) {
  const router = useRouter();
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const [teams, setTeams] = useState<string[]>([]);
  const [fieldErr, setFieldErr] = useState<{ motivation?: string }>({});
  const [topErr, setTopErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  useFocusFirstError(form, fieldErr);

  const len = text.trim().length;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTopErr(null);
    if (len < MIN || len > MAX) { setFieldErr({ motivation: c.motivationErr }); return; }
    setFieldErr({});
    start(async () => {
      const r = await applyForMembershipAction({ motivation: text.trim(), team_interest: teams });
      if (r.ok) { setSent(true); toast(c.sent); router.refresh(); return; }
      if (r.error === "invalid") setFieldErr({ motivation: c.motivationErr });
      else setTopErr(errors[r.error] ?? errors.server);
    });
  }

  return (
    <form ref={form} onSubmit={submit} noValidate className="grid gap-4 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <div className="flex items-center gap-3"><Icon3D name="rocket" sizes="64px" className="size-12 shrink-0 drop-shadow-[0_6px_8px_rgb(0_40_70/0.25)]" /><h2 className="font-display text-xl font-bold text-fg">{c.formTitle}</h2></div>
      <Field label={c.motivation} required error={fieldErr.motivation}
        hint={<><span>{c.motivationHint}</span> <span className={cx("tnum", len > MAX && "font-bold text-danger-fg")}>{fill(c.counter, { n: len, max: MAX })}</span></>}>
        {(ctl) => <Textarea {...ctl} name="motivation" rows={5} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-fg">{c.interests}</legend>
        <p className="text-sm text-fg-muted">{c.interestsHint}</p>
        <div className="flex flex-wrap gap-2">
          {TEAM_KEYS.map((k) => {
            const on = teams.includes(k);
            return (
              <label key={k} className={cx("inline-flex min-h-11 cursor-pointer items-center rounded-full border-2 px-4 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", on ? "border-accent bg-accent-soft text-accent-fg" : "border-line bg-panel-2 text-fg")}>
                <input type="checkbox" name="team_interest" value={k} checked={on} onChange={() => setTeams((t) => (on ? t.filter((x) => x !== k) : [...t, k]))} className="sr-only" />
                {c.teams[k]}
              </label>
            );
          })}
        </div>
      </fieldset>
      <p role="alert" className="text-sm font-bold text-danger-fg empty:hidden">{topErr}</p>
      <StickyBar aboveTabs label={c.formTitle}>
        <Button type="submit" size="lg" disabled={pending || sent} aria-busy={pending} className="min-h-12 flex-1 text-lg md:flex-none md:px-10">{pending ? c.submitting : c.submit}</Button>
      </StickyBar>
    </form>
  );
}
