"use client";
import { Lock, TriangleAlert } from "lucide-react";
import { fill, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-events";
import { plural } from "@/i18n/plural";
import { acceptImpact, type RegRow, type TeamRow } from "@/lib/events/admin-registrations";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import StatusPill from "@/components/ui/StatusPill";
import type { RegStatus } from "@/lib/status";

/** Teams as cards: members, who is captain, what they are looking for, status mix, and accept / reject for the whole team. */
export default function TeamBoard({ lang, rows, teams, capacity, teamMin, teamMax, pending, statusLabel, onDecide, onSolo, onList }: {
  lang: Locale; rows: RegRow[]; teams: TeamRow[]; capacity: number | null; teamMin: number; teamMax: number; pending: boolean;
  statusLabel: (s: RegStatus) => string; onDecide: (ids: string[], d: "accept" | "reject") => void; onSolo: () => void; onList: () => void;
}) {
  const t = copy[lang].regs.teams;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const solo = rows.filter((r) => !r.teamId && r.status !== "cancelled").length;
  const live = teams.map((tm) => ({ tm, members: tm.memberIds.map((id) => byId.get(id)).filter((r): r is RegRow => !!r && r.status !== "cancelled") })).filter((x) => x.members.length > 0);

  if (live.length === 0) {
    return <EmptyState sticker="team" title={t.empty.title} line={t.empty.line} action={<Button variant="secondary" onClick={onList}>{t.empty.action}</Button>} />;
  }
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-fg-muted">{plural(lang, live.length, t.count)}</p>
        {solo > 0 && <Button variant="secondary" size="sm" onClick={onSolo}>{fill(t.solo, { n: solo })}</Button>}
      </div>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {live.map(({ tm, members }) => {
          const mix = [...members.reduce((m, r) => m.set(r.status, (m.get(r.status) ?? 0) + 1), new Map<RegStatus, number>())];
          const actionable = members.some((r) => r.status === "applied" || r.status === "waitlisted" || r.status === "going" || r.status === "rejected");
          const impact = acceptImpact(rows, members.map((r) => r.id), "team", capacity);
          const accept = impact.adding > 0 && impact.over === 0;
          return (
            <li key={tm.id} className="grid content-start gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 font-bold break-words text-fg">{tm.name}</h3>
                <p className="tnum text-sm font-semibold text-fg-muted">{fill(t.size, { n: members.length, max: teamMax })}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mix.map(([status, n]) => <StatusPill key={status} status={status} label={`${statusLabel(status)} · ${n}`} />)}
                {tm.locked && <span className="inline-flex items-center gap-1 rounded-full bg-neutral-soft px-2.5 py-0.5 text-xs font-bold text-fg"><Lock aria-hidden="true" size={12} />{t.locked}</span>}
              </div>
              {members.length < teamMin && (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-warn-fg"><TriangleAlert aria-hidden="true" size={14} />{fill(t.belowMin, { min: teamMin })}</p>
              )}
              <ul aria-label={fill(t.members, { team: tm.name })} className="grid gap-2">
                {members.map((r) => (
                  <li key={r.id} className="flex items-center gap-2.5">
                    <Avatar name={tf(r.name, lang)} src={r.avatar} size={28} />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{tf(r.name, lang)}</span>
                    {r.profileId === tm.captainId && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-fg">{t.captain}</span>}
                  </li>
                ))}
              </ul>
              {tm.lookingFor.length > 0 && <p className="text-sm text-fg-muted">{fill(t.lookingFor, { skills: tm.lookingFor.join(", ") })}</p>}
              {impact.over > 0 && <p role="status" className="text-sm font-semibold text-danger-fg">{fill(copy[lang].regs.bulk.over, { n: impact.over, max: capacity ?? 0 })}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending || !actionable || !accept} onClick={() => onDecide(members.map((r) => r.id), "accept")}>{t.acceptTeam}</Button>
                <Button size="sm" variant="secondary" disabled={pending || !actionable} onClick={() => onDecide(members.map((r) => r.id), "reject")}>{t.rejectTeam}</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
