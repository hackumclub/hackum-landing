"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeftRight, GitMerge } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button, { ButtonLink } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import { cx } from "@/components/ui/cx";
import { fill, type Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { mergeImpact } from "@/lib/members/duplicates";
import { mergeProfilesAction } from "@/lib/members/actions";
import { relativeTime } from "@/lib/members/format";
import type { MergeData, MergeProfileDto } from "./data";
import { CARD } from "@/components/admin/members/card";
import { NoticeBanner, PersonPicker, errorText, personName, type Notice } from "./shared";

const REASON_TONE = { name: "bg-accent-soft text-accent-fg", email: "bg-accent-soft text-accent-fg", similar: "bg-warn-soft text-warn-fg" } as const;

/** Default "keep": the profile someone can actually sign in with, else the one with more history. */
function defaultKeep(a: MergeProfileDto, b: MergeProfileDto): string {
  if (a.claimed !== b.claimed) return a.claimed ? a.id : b.id;
  return b.regEvents.length + b.seasons.length > a.regEvents.length + a.seasons.length ? b.id : a.id;
}

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 border-t border-line py-1.5 text-sm first:border-t-0"><dt className="text-fg-muted">{k}</dt><dd className="tnum text-right text-fg">{v}</dd></div>
);

function ProfileCard({ p, lang, now, c, status, keep, onKeep }: {
  p: MergeProfileDto; lang: Locale; now: Date; c: AreaCopy["members"]["merge"]; status: Dict["status"]; keep: boolean; onKeep: () => void;
}) {
  const name = personName(p, lang);
  return (
    <label className={cx("grid cursor-pointer content-start gap-3 rounded-[var(--radius-md)] border-2 p-4 transition-colors duration-150", keep ? "border-accent bg-accent-soft shadow-[var(--shadow-card)]" : "border-line bg-panel")}>
      <span className="flex items-center gap-3">
        <Avatar name={name} size={48} />
        <span className="grid min-w-0 flex-1">
          <span className="font-semibold [overflow-wrap:anywhere] text-fg">{name}</span>
          <span className="text-xs break-all text-fg-muted">@{p.handle}</span>
        </span>
        <span className={cx("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", keep ? "bg-accent text-on-accent" : "bg-neutral-soft text-fg")}>{keep ? c.keepBadge : c.dropBadge}</span>
      </span>
      <dl>
        <Row k={c.status} v={<StatusPill status={p.status} label={status[p.status]} />} />
        <Row k={c.school} v={p.school ?? "—"} />
        <Row k={c.registrations} v={new Set(p.regEvents).size} />
        <Row k={c.memberships} v={new Set(p.seasons).size} />
        <Row k={c.applications} v={new Set(p.appSeasons).size} />
        <Row k={c.account} v={p.claimed ? c.claimed : c.unclaimed} />
        <Row k={c.lastSeen} v={p.lastSeenAt ? relativeTime(new Date(p.lastSeenAt), now, lang) : "—"} />
      </dl>
      <span className="inline-flex min-h-10 items-center gap-2.5 text-sm font-semibold text-fg">
        <input type="radio" name="merge-keep" value={p.id} checked={keep} onChange={onKeep} className="size-5 accent-[var(--ops-accent)]" />
        {c.keep}
      </span>
    </label>
  );
}

export default function MergePanel({ data, lang, c, common, status }: {
  data: MergeData; lang: Locale; c: AreaCopy["members"]["merge"]; common: AreaCopy["common"]; status: Dict["status"];
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [pair, setPair] = useState<{ a: string; b: string } | null>(null);
  const [pa, setPa] = useState("");
  const [pb, setPb] = useState("");
  const [keepChoice, setKeepChoice] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const now = useMemo(() => new Date(data.now), [data.now]);
  const byId = useMemo(() => new Map(data.profiles.map((p) => [p.id, p])), [data.profiles]);

  const A = pair ? byId.get(pair.a) : undefined;
  const B = pair ? byId.get(pair.b) : undefined;
  const keepId = A && B ? (keepChoice === A.id || keepChoice === B.id ? keepChoice : defaultKeep(A, B)) : null;
  const keep = keepId === A?.id ? A : B;
  const drop = keepId === A?.id ? B : A;

  const pairKey = pair ? `${pair.a}|${pair.b}` : "";
  useEffect(() => { if (pairKey) compareRef.current?.focus(); }, [pairKey]);

  const choose = (a: string, b: string) => { setPair({ a, b }); setKeepChoice(null); setNotice(null); };
  const pickManual = (which: "a" | "b", id: string) => {
    const na = which === "a" ? id : pa, nb = which === "b" ? id : pb;
    if (which === "a") setPa(id); else setPb(id);
    if (na && nb && na !== nb) choose(na, nb); else if (pair) setPair(null);
  };
  const sameManual = pa !== "" && pa === pb;

  const impact = keep && drop ? mergeImpact({ regEvents: keep.regEvents, seasons: keep.seasons, appSeasons: keep.appSeasons }, { regEvents: drop.regEvents, seasons: drop.seasons, appSeasons: drop.appSeasons }) : null;
  const moves = impact
    ? [impact.registrations ? plural(lang, impact.registrations, c.moves.registrations) : "", impact.seasons ? plural(lang, impact.seasons, c.moves.seasons) : "", impact.applications ? plural(lang, impact.applications, c.moves.applications) : ""].filter(Boolean).join(", ")
    : "";

  const run = () => {
    if (!keep || !drop) return;
    const names = { keep: personName(keep, lang), drop: personName(drop, lang) };
    startTransition(async () => {
      const r = await mergeProfilesAction(keep.id, drop.id);
      if (r.ok) {
        setNotice({ tone: "ok", text: fill(c.done, names) });
        setPair(null); setPa(""); setPb("");
      } else {
        setNotice({ tone: "error", text: r.error === "invalid" ? c.conflictSelf : errorText(common.errors, r.error) });
      }
      router.refresh();
    });
  };

  const suggestions = data.suggestions.filter((s) => byId.has(s.a) && byId.has(s.b));

  return (
    <div className="grid gap-6">
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />

      <section aria-labelledby="dupes" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="dupes" className="font-display text-base font-bold text-fg">{c.suggestions}</h2>
          <span className="tnum text-sm text-fg-muted">{plural(lang, suggestions.length, c.suggestionsCount)}</span>
        </div>
        {suggestions.length === 0 ? (
          <EmptyState sticker="checkin" title={c.none} line={c.noneLine} action={<ButtonLink variant="secondary" href="#manual">{c.noneAction}</ButtonLink>} />
        ) : (
          <ul className={cx(CARD, "overflow-hidden")}>
            {suggestions.map((s) => {
              const x = byId.get(s.a)!, y = byId.get(s.b)!;
              const active = pair?.a === s.a && pair.b === s.b;
              return (
                <li key={`${s.a}|${s.b}`} className={cx("grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", active && "bg-accent-soft")}>
                  <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
                    {[x, y].map((p, i) => (
                      <span key={p.id} className={cx("flex min-w-0 items-center gap-2.5", i === 1 && "sm:col-start-3")}>
                        <Avatar name={personName(p, lang)} size={36} />
                        <span className="grid min-w-0"><span className="text-sm font-semibold [overflow-wrap:anywhere] text-fg">{personName(p, lang)}</span><span className="text-xs break-all text-fg-muted">@{p.handle}</span></span>
                      </span>
                    ))}
                    <ArrowLeftRight aria-hidden="true" size={16} className="hidden text-fg-muted sm:col-start-2 sm:row-start-1 sm:block" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", REASON_TONE[s.reason])}>{c.reason[s.reason]}</span>
                    <Button variant="secondary" aria-pressed={active} onClick={() => choose(s.a, s.b)}>{c.compare}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id="manual" aria-labelledby="manual-h" className={cx(CARD, "grid scroll-mt-20 gap-3 p-4 md:p-5")}>
        <div className="grid gap-0.5">
          <h2 id="manual-h" className="font-display text-base font-bold text-fg">{c.manual}</h2>
          <p className="text-sm text-fg-muted">{c.manualLead}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <PersonPicker label={c.pickA} people={data.profiles} value={pa} onChange={(id) => pickManual("a", id)} lang={lang} c={c} />
          <PersonPicker label={c.pickB} people={data.profiles} value={pb} onChange={(id) => pickManual("b", id)} lang={lang} c={c} error={sameManual ? c.sameProfile : undefined} />
        </div>
      </section>

      {A && B && keep && drop && impact && (
        <section aria-labelledby="compare" className={cx(CARD, "grid gap-4 border-accent p-4 md:p-5")}>
          <div ref={compareRef} tabIndex={-1} className="grid gap-0.5 outline-none">
            <h2 id="compare" className="font-display text-base font-bold text-fg">{c.compareTitle}</h2>
            <p className="text-sm text-fg-muted">{c.willMerge}</p>
          </div>
          <fieldset className="grid gap-3">
            <legend className="sr-only">{c.keepLegend}</legend>
            <div className="grid gap-3 md:grid-cols-2">
              <ProfileCard p={A} lang={lang} now={now} c={c} status={status} keep={keepId === A.id} onKeep={() => setKeepChoice(A.id)} />
              <ProfileCard p={B} lang={lang} now={now} c={c} status={status} keep={keepId === B.id} onKeep={() => setKeepChoice(B.id)} />
            </div>
          </fieldset>
          <div className="sticky bottom-3 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line-strong bg-panel px-3 py-3 shadow-[var(--shadow-card)]">
            <p className="min-w-0 flex-1 text-sm text-fg-muted max-sm:basis-full">{moves ? fill(c.confirmBody, { moves }) : fill(c.confirmNothing, { drop: personName(drop, lang) })}</p>
            <ConfirmDialog
              trigger={<Button variant="danger" size="lg" className="max-sm:w-full" icon={<GitMerge aria-hidden="true" size={18} />} disabled={busy}>{c.mergeButton}</Button>}
              title={fill(c.confirmTitle, { drop: personName(drop, lang), keep: personName(keep, lang) })}
              body={<>
                {moves ? fill(c.confirmBody, { moves }) : fill(c.confirmNothing, { drop: personName(drop, lang) })}
                {drop.claimed && <> {fill(c.confirmAccount, { drop: personName(drop, lang) })}</>}
              </>}
              confirmLabel={c.mergeButton}
              cancelLabel={common.cancel}
              tone="danger"
              onConfirm={run}
            />
          </div>
        </section>
      )}
    </div>
  );
}
