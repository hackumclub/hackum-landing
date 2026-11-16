"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { GraduationCap, Mail, RefreshCw, ShieldCheck, UserRound } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Drawer from "@/components/ui/Drawer";
import StatusPill from "@/components/ui/StatusPill";
import Avatar from "@/components/ui/Avatar";
import { fill, tf, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { setStatusAction } from "@/lib/members/actions";
import { relativeTime } from "@/lib/members/format";
import type { MemberStatus } from "@/lib/status";
import { formatUb } from "@/lib/time";
import type { MemberDto } from "./data";
import { errorText } from "./shared";

const SAFE_URL = /^https?:\/\//i;
const TARGETS: { status: MemberStatus; verb: "promote" | "alumni" | "guest" }[] = [
  { status: "member", verb: "promote" }, { status: "alumni", verb: "alumni" }, { status: "guest", verb: "guest" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h3 className="font-display text-sm font-bold text-fg">{title}</h3>
      {children}
    </section>
  );
}
const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-sm">
    <dt className="text-fg-muted">{k}</dt>
    <dd className="min-w-0 break-words text-fg">{children}</dd>
  </div>
);

/**
 * Profile card for staff: who they are at a glance (avatar, status, school/year), seasons as chips, registrations, applications,
 * then contact details. The one big action, "Change status", is pinned to the bottom so it is always in reach on a phone.
 */
export default function MemberDrawer({ member, now, lang, c, common, bulk, status, onClose }: {
  member: MemberDto | null; now: Date; lang: Locale; c: AreaCopy["members"]["drawer"] & { never: string }; common: AreaCopy["common"];
  bulk: AreaCopy["members"]["directory"]["bulk"]; status: Dict["status"]; onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choosing, setChoosing] = useState(false);
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string; for: string } | null>(null);
  const name = member ? tf(member.name, lang).trim() || member.name.mn || member.handle : "";
  const when = (iso: string) => formatUb(new Date(iso), lang, { year: "numeric", month: "short", day: "numeric" });
  const notice = result && member && result.for === member.id ? result : null;

  const change = (target: MemberStatus) => {
    if (!member) return;
    const id = member.id;
    startTransition(async () => {
      const r = await setStatusAction([id], target);
      setResult(r.ok ? { tone: "ok", text: fill(c.setDone, { name, status: status[target] }), for: id } : { tone: "error", text: errorText(common.errors, r.error), for: id });
      setChoosing(false);
      router.refresh();
    });
  };

  const close = () => { setChoosing(false); onClose(); };
  return (
    <Drawer open={member !== null} onOpenChange={(o) => { if (!o) close(); }} title={name} description={c.description} closeLabel={c.close}>
      {member && (
        <div className="grid gap-5">
          <div className="grid justify-items-center gap-2 rounded-[var(--radius-md)] bg-[radial-gradient(120%_120%_at_50%_0%,var(--ops-accent-soft),var(--ops-panel)_70%)] px-4 py-5 text-center">
            <Avatar name={name} size={72} className="ring-4 ring-panel" />
            <p className="font-display text-xl font-black [overflow-wrap:anywhere] text-fg">{name}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <StatusPill status={member.status} label={status[member.status]} />
              <span className="text-sm text-fg-muted">@{member.handle}</span>
            </div>
            {(member.school || member.gradYear) && (
              <p className="inline-flex flex-wrap items-center justify-center gap-1.5 text-sm text-fg">
                <GraduationCap aria-hidden="true" size={16} className="text-fg-muted" />
                {[member.school, member.gradYear ? fill(c.classOf, { year: member.gradYear }) : null].filter(Boolean).join(" · ")}
              </p>
            )}
            {member.major && <p className="text-sm text-fg-muted">{member.major}</p>}
          </div>

          {notice && (
            <p role={notice.tone === "ok" ? "status" : "alert"} className={notice.tone === "ok" ? "rounded-[var(--radius-sm)] bg-ok-soft px-3 py-2 text-sm font-semibold text-ok-fg" : "rounded-[var(--radius-sm)] bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-fg"}>{notice.text}</p>
          )}

          <Section title={c.seasons}>
            {member.memberships.length === 0 ? <p className="text-sm text-fg-muted">{c.noSeasons}</p> : (
              <ul className="flex flex-wrap gap-2">
                {member.memberships.map((m) => (
                  <li key={m.season} className="tnum inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-fg">
                    {m.season}
                    {(m.team || m.role) && <span className="font-normal">· {[m.team, m.role ? tf(m.role, lang) : null].filter(Boolean).join(" · ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={c.registrations}>
            {member.registrations.length === 0 ? <p className="text-sm text-fg-muted">{c.noRegistrations}</p> : (
              <ul className="grid gap-2">
                {member.registrations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2 text-sm">
                    <span className="grid min-w-0">
                      <span className="font-semibold [overflow-wrap:anywhere] text-fg">{tf(r.event, lang)}</span>
                      <span className="text-xs text-fg-muted">{when(r.startsAt)}</span>
                    </span>
                    <StatusPill status={r.status} label={status[r.status]} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={c.applications}>
            {member.applications.length === 0 ? <p className="text-sm text-fg-muted">{c.noApplications}</p> : (
              <ul className="grid gap-2">
                {member.applications.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2 text-sm">
                    <span className="grid">
                      <span className="tnum font-semibold text-fg">{fill(c.season, { year: a.season })}</span>
                      <span className="text-xs text-fg-muted">{when(a.createdAt)}</span>
                    </span>
                    <StatusPill status={a.status} label={status[a.status]} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={c.contact}>
            <dl className="grid gap-2">
              <Row k={c.email}>
                {member.email ? (
                  <span className="grid gap-0.5">
                    <span className="inline-flex items-center gap-1.5 font-semibold"><Mail aria-hidden="true" size={14} />{member.email}</span>
                    <span className="text-xs text-fg-muted">{c.emailNote}</span>
                  </span>
                ) : <span className="text-fg-muted">{c.noEmail}</span>}
              </Row>
              <Row k={c.account}>
                <span className="inline-flex items-center gap-1.5">
                  {member.claimed ? <ShieldCheck aria-hidden="true" size={14} className="text-ok-fg" /> : <UserRound aria-hidden="true" size={14} className="text-fg-muted" />}
                  {member.claimed ? c.claimed : c.unclaimed}
                </span>
              </Row>
              <Row k={c.school}>{member.school ?? "—"}</Row>
              <Row k={c.major}>{member.major ?? "—"}</Row>
              <Row k={c.gradYear}>{member.gradYear ?? "—"}</Row>
              <Row k={c.language}>{member.locale === "mn" ? "Монгол" : "English"}</Row>
              <Row k={c.joined}>{when(member.createdAt)}</Row>
              <Row k={c.lastSeen}>{member.lastSeenAt ? <span title={formatUb(new Date(member.lastSeenAt), lang, { dateStyle: "medium", timeStyle: "short" })}>{relativeTime(new Date(member.lastSeenAt), now, lang)}</span> : c.never}</Row>
              {Object.entries(member.links).filter(([, v]) => SAFE_URL.test(v)).map(([k, v]) => (
                <Row key={k} k={`${c.links} · ${k}`}><a href={v} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-accent-fg hover:underline">{v}</a></Row>
              ))}
            </dl>
          </Section>

          <div className="sticky -bottom-4 z-10 -mx-4 -mb-4 grid gap-3 border-t border-line bg-panel px-4 py-4">
            {choosing ? (
              <>
                <p className="text-sm font-semibold text-fg">{c.changeStatusLead}</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TARGETS.filter((t) => t.status !== member.status).map(({ status: target, verb }) => (
                    <ConfirmDialog
                      key={target}
                      trigger={<Button variant="secondary" size="lg" disabled={pending} className="w-full">{status[target]}</Button>}
                      title={fill(c.setTitle, { name, status: status[target] })}
                      body={c.setBody}
                      confirmLabel={bulk[verb]}
                      cancelLabel={common.cancel}
                      onConfirm={() => change(target)}
                    />
                  ))}
                </div>
                <Button variant="ghost" onClick={() => setChoosing(false)}>{common.cancel}</Button>
              </>
            ) : (
              <Button size="lg" className="w-full" icon={<RefreshCw aria-hidden="true" size={18} />} disabled={pending} onClick={() => setChoosing(true)}>{c.changeStatus}</Button>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
