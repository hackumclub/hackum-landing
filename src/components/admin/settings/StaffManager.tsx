"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DataTable, { type Column } from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import Field, { Select } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import { fill, type Locale } from "@/i18n/config";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { grantRoleAction } from "@/lib/members/actions";
import type { StaffRoleName } from "@/lib/mockdb/types";
import { formatUb } from "@/lib/time";
import { NoticeBanner, PersonCell, PersonPicker, errorText, personName, type Notice } from "@/components/admin/members/shared";
import type { StaffData, StaffDto } from "./data";

/** Role pills reuse existing tones (admin = ink, organizer = accent): no new colours. */
export function RolePill({ role, label }: { role: StaffRoleName; label: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", role === "admin" ? "bg-fg text-canvas" : "bg-accent-soft text-accent-fg")}>
      {role === "admin" && <ShieldCheck aria-hidden="true" size={12} />}
      {label}
    </span>
  );
}

export default function StaffManager({ data, lang, c, common }: { data: StaffData; lang: Locale; c: AreaCopy["settings"]["staff"]; common: AreaCopy["common"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [personId, setPersonId] = useState("");
  const [role, setRole] = useState<StaffRoleName>("organizer");
  const picked = useMemo(() => data.candidates.find((p) => p.id === personId) ?? null, [data.candidates, personId]);

  const run = (profileId: string, next: StaffRoleName | null, done: string) => startTransition(async () => {
    const r = await grantRoleAction(profileId, next);
    if (r.ok) {
      setNotice({ tone: "ok", text: done });
      if (profileId === personId) setPersonId("");
    } else {
      setNotice({ tone: "error", text: r.error === "conflict" ? c.conflict : errorText(common.errors, r.error) });
    }
    router.refresh();
  });

  const columns: Column<StaffDto>[] = [
    {
      key: "person", header: c.columns.person, sortValue: (s) => personName(s, lang).toLowerCase(),
      cell: (s) => <PersonCell name={personName(s, lang)} sub={`@${s.handle}`}><span className="flex items-center gap-2 truncate font-semibold">{personName(s, lang)}{s.isYou && <span className="rounded-full bg-neutral-soft px-2 py-0.5 text-xs font-bold text-fg">{c.you}</span>}</span></PersonCell>,
    },
    { key: "role", header: c.columns.role, sortValue: (s) => s.role, cell: (s) => <RolePill role={s.role} label={c.roles[s.role]} /> },
    {
      key: "since", header: c.columns.since, hideBelow: "md", sortValue: (s) => s.grantedAt,
      cell: (s) => <span className="grid"><span>{formatUb(new Date(s.grantedAt), lang, { year: "numeric", month: "short", day: "numeric" })}</span>{s.grantedBy && <span className="text-xs text-fg-muted">{fill(c.grantedBy, { who: s.grantedBy })}</span>}</span>,
    },
    {
      key: "actions", header: c.columns.actions,
      cell: (s) => {
        const name = personName(s, lang);
        const target: StaffRoleName = s.role === "admin" ? "organizer" : "admin";
        return (
          <span className="flex flex-wrap gap-1.5">
            <ConfirmDialog
              trigger={<Button size="sm" variant="secondary" disabled={pending} aria-label={`${target === "admin" ? c.makeAdmin : c.makeOrganizer}: ${name}`}>{target === "admin" ? c.makeAdmin : c.makeOrganizer}</Button>}
              title={fill(c.grantTitle[target], { name })}
              body={c.grantBody[target]}
              confirmLabel={target === "admin" ? c.makeAdmin : c.makeOrganizer}
              cancelLabel={common.cancel}
              onConfirm={() => run(s.id, target, fill(c.roleChanged, { name, role: c.roles[target] }))}
            />
            <ConfirmDialog
              trigger={<Button size="sm" variant="ghost" icon={<UserMinus aria-hidden="true" size={14} />} disabled={pending} aria-label={`${c.remove}: ${name}`}>{c.remove}</Button>}
              title={fill(c.removeTitle, { name })}
              body={fill(c.removeBody, { name })}
              confirmLabel={c.removeConfirm}
              cancelLabel={common.cancel}
              tone="danger"
              onConfirm={() => run(s.id, null, fill(c.removed, { name }))}
            />
          </span>
        );
      },
    },
  ];

  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-sm text-fg-muted">{c.lead}</p>
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      <DataTable<StaffDto> rows={data.staff} columns={columns} getId={(s) => s.id} caption={c.caption} empty={<EmptyState sticker="sleepy" title={c.emptyTitle} line={c.emptyLine} />} />

      <section aria-labelledby="add-staff" className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
        <div className="grid gap-0.5">
          <h2 id="add-staff" className="font-display text-base font-bold text-fg">{c.add}</h2>
          <p className="text-sm text-fg-muted">{c.addLead}</p>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
          <PersonPicker label={c.person} people={data.candidates} value={personId} onChange={setPersonId} lang={lang}
            c={{ find: c.find, findPlaceholder: c.findPlaceholder, noMatches: c.noMatches, pickPrompt: c.pick }} hint={personId ? undefined : c.pickFirst} />
          <Field label={c.role}>
            {(ctl) => (
              <Select {...ctl} value={role} onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "organizer")}>
                <option value="organizer">{c.roles.organizer}</option>
                <option value="admin">{c.roles.admin}</option>
              </Select>
            )}
          </Field>
          <div className="md:pt-[1.875rem]">
            <ConfirmDialog
              trigger={<Button icon={<UserPlus aria-hidden="true" size={16} />} disabled={!picked || pending}>{c.grant}</Button>}
              title={fill(c.grantTitle[role], { name: picked ? personName(picked, lang) : "" })}
              body={c.grantBody[role]}
              confirmLabel={c.grant}
              cancelLabel={common.cancel}
              onConfirm={() => picked && run(picked.id, role, fill(c.granted, { name: personName(picked, lang), role: c.roles[role] }))}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
