"use client";
import { Mail, ShieldCheck, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import Drawer from "@/components/ui/Drawer";
import StatusPill from "@/components/ui/StatusPill";
import Avatar from "@/components/ui/Avatar";
import { fill, tf, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { formatUb } from "@/lib/time";
import { relativeTime } from "@/lib/members/format";
import type { MemberDto } from "./data";

const SAFE_URL = /^https?:\/\//i;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="font-display text-sm font-bold text-fg">{title}</h3>
      {children}
    </section>
  );
}
const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2 text-sm">
    <dt className="text-fg-muted">{k}</dt>
    <dd className="min-w-0 break-words text-fg">{children}</dd>
  </div>
);

/** Full profile for staff: contact (email is shown to staff here and nowhere in a list), roster history, registrations, applications. */
export default function MemberDrawer({ member, now, lang, c, status, onClose }: {
  member: MemberDto | null; now: Date; lang: Locale; c: AreaCopy["members"]["drawer"] & { never: string }; status: Dict["status"]; onClose: () => void;
}) {
  const name = member ? tf(member.name, lang).trim() || member.name.mn || member.handle : "";
  const when = (iso: string) => formatUb(new Date(iso), lang, { year: "numeric", month: "short", day: "numeric" });
  return (
    <Drawer open={member !== null} onOpenChange={(o) => { if (!o) onClose(); }} title={name} description={c.description} closeLabel={c.close}>
      {member && (
        <div className="grid gap-5">
          <div className="flex items-center gap-3">
            <Avatar name={name} size={56} />
            <div className="grid min-w-0 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={member.status} label={status[member.status]} />
                <span className="text-sm text-fg-muted">@{member.handle}</span>
              </div>
              {member.name.mn && member.name.en && member.name.mn !== member.name.en && <p className="truncate text-sm text-fg-muted">{lang === "mn" ? member.name.en : member.name.mn}</p>}
            </div>
          </div>

          <Section title={c.contact}>
            <dl className="grid gap-1.5">
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

          <Section title={c.seasons}>
            {member.memberships.length === 0 ? <p className="text-sm text-fg-muted">{c.noSeasons}</p> : (
              <ul className="grid gap-1.5">
                {member.memberships.map((m) => (
                  <li key={m.season} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="tnum font-semibold text-fg">{fill(c.season, { year: m.season })}</span>
                    <span className="text-fg-muted">{[m.team, m.role ? tf(m.role, lang) : null].filter(Boolean).join(" · ") || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={c.registrations}>
            {member.registrations.length === 0 ? <p className="text-sm text-fg-muted">{c.noRegistrations}</p> : (
              <ul className="grid gap-2">
                {member.registrations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="grid min-w-0">
                      <span className="truncate font-semibold text-fg">{tf(r.event, lang)}</span>
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
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
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
        </div>
      )}
    </Drawer>
  );
}
