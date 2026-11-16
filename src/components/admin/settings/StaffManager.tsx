"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import Button, { ButtonLink } from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";
import { cx } from "@/components/ui/cx";
import { fill, type Locale } from "@/i18n/config";
import { copy as shellCopy } from "@/i18n/areas/shell";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { grantRoleAction } from "@/lib/members/actions";
import type { StaffRoleName } from "@/lib/mockdb/types";
import { formatUbStable } from "@/lib/time";
import { CARD } from "@/components/admin/members/card";
import { NoticeBanner, PersonPicker, errorText, personName, type Notice } from "@/components/admin/members/shared";
import type { StaffData } from "./data";
import Tag from "@/components/ui/Tag";

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

  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-sm text-fg-muted">{c.lead}</p>
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={common.dismiss} />
      {data.staff.length === 0 ? (
        <EmptyState sticker="sleepy" title={c.emptyTitle} line={c.emptyLine} action={<ButtonLink variant="secondary" href="#add-staff">{c.emptyAction}</ButtonLink>} />
      ) : (
        <ul aria-label={c.caption} className="grid gap-3 md:grid-cols-2">
          {data.staff.map((s) => {
            const name = personName(s, lang);
            const target: StaffRoleName = s.role === "admin" ? "organizer" : "admin";
            // The rule refuses both (conflict), so the buttons are disabled with the reason on screen (F-18).
            const lastAdmin = s.role === "admin" && data.adminCount <= 1;
            const locked = s.isYou || lastAdmin;
            const reasonText = lastAdmin ? shellCopy[lang].staff.lastAdminReason : shellCopy[lang].staff.selfReason;
            const reasonId = `staff-lock-${s.id}`;
            return (
              <li key={s.id} data-testid="staff-item" className={cx(CARD, "grid content-start gap-4 p-4 md:p-5", s.isYou && "border-accent")}>
                <div className="flex items-center gap-3">
                  <Avatar name={name} size={52} />
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="flex flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere] text-fg">
                      {name}
                      {s.isYou && <Tag>{c.you}</Tag>}
                    </p>
                    <p className="text-sm break-all text-fg-muted">@{s.handle}</p>
                  </div>
                  <RolePill role={s.role} label={c.roles[s.role]} />
                </div>
                <p className="text-sm text-fg-muted">
                  {formatUbStable(new Date(s.grantedAt), lang, "date")}
                  {s.grantedBy && <> · {fill(c.grantedBy, { who: s.grantedBy })}</>}
                </p>
                {locked ? (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" disabled aria-describedby={reasonId} aria-label={`${target === "admin" ? c.makeAdmin : c.makeOrganizer}: ${name}`}>{target === "admin" ? c.makeAdmin : c.makeOrganizer}</Button>
                      <Button variant="ghost" icon={<UserMinus aria-hidden="true" size={14} />} disabled aria-describedby={reasonId} aria-label={`${c.remove}: ${name}`}>{c.remove}</Button>
                    </div>
                    <p id={reasonId} className="text-sm text-fg-muted">{reasonText}</p>
                  </div>
                ) : (
                <div className="flex flex-wrap gap-2">
                  <ConfirmDialog
                    trigger={<Button variant="secondary" disabled={pending} aria-label={`${target === "admin" ? c.makeAdmin : c.makeOrganizer}: ${name}`}>{target === "admin" ? c.makeAdmin : c.makeOrganizer}</Button>}
                    title={fill(c.grantTitle[target], { name })}
                    body={c.grantBody[target]}
                    confirmLabel={target === "admin" ? c.makeAdmin : c.makeOrganizer}
                    cancelLabel={common.cancel}
                    onConfirm={() => run(s.id, target, fill(c.roleChanged, { name, role: c.roles[target] }))}
                  />
                  <ConfirmDialog
                    trigger={<Button variant="ghost" icon={<UserMinus aria-hidden="true" size={14} />} disabled={pending} aria-label={`${c.remove}: ${name}`}>{c.remove}</Button>}
                    title={fill(c.removeTitle, { name })}
                    body={fill(c.removeBody, { name })}
                    confirmLabel={c.removeConfirm}
                    cancelLabel={common.cancel}
                    tone="danger"
                    onConfirm={() => run(s.id, null, fill(c.removed, { name }))}
                  />
                </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section id="add-staff" aria-labelledby="add-staff-h" className={cx(CARD, "grid scroll-mt-20 gap-3 p-4 md:p-5")}>
        <div className="grid gap-0.5">
          <h2 id="add-staff-h" className="font-display text-base font-bold text-fg">{c.add}</h2>
          <p className="text-sm text-fg-muted">{c.addLead}</p>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
          <PersonPicker label={c.person} people={data.candidates} value={personId} onChange={setPersonId} lang={lang}
            c={{ find: c.find, findPlaceholder: c.findPlaceholder, noMatches: c.noMatches, pickPrompt: c.pick }} hint={personId ? undefined : c.pickFirst} />
          <Field label={c.role}>
            {(ctl) => (
              <Select
                {...ctl} value={role} onValueChange={(v) => setRole(v === "admin" ? "admin" : "organizer")}
                options={[{ value: "organizer", label: c.roles.organizer }, { value: "admin", label: c.roles.admin }]}
              />
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
