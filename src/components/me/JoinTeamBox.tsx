"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { MeCopy } from "@/i18n/areas/me";
import { fill } from "@/i18n/config";
import { joinTeamByCode } from "@/lib/me/actions";
import { useToast } from "./Toast";
import Button from "@/components/ui/Button";
import Field, { Input } from "@/components/ui/Field";

/** Join an existing team by invite code (for applicants who have no team yet). */
export default function JoinTeamBox({ c, max, defaultCode = "" }: { c: MeCopy["apply"]; max: number; defaultCode?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState(defaultCode);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (!value) { setError(c.codeNeeded); return; }
    setError(null);
    start(async () => {
      const r = await joinTeamByCode(value);
      if (r.ok) { toast(c.joinedTeam); router.refresh(); return; }
      setError(({
        not_found: c.codeNotFound, forbidden: c.joinForbidden, conflict: c.joinConflict, closed: c.codeClosed, full: fill(c.codeFull, { max }),
        invalid: c.codeInvalid, unauthenticated: c.err.unauthenticated, rate_limited: c.err.rate_limited, server: c.err.server,
      } as Record<string, string>)[r.error] ?? c.err.server);
    });
  }
  return (
    <form onSubmit={submit} noValidate className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
      <div className="grid gap-1"><h2 className="font-display text-lg font-bold text-fg">{c.joinTeamTitle}</h2><p className="text-sm text-fg-muted">{c.joinTeamLine}</p></div>
      <Field label={c.teamCode} hint={c.teamCodeHint} error={error ?? undefined}>
        {(ctl) => <Input {...ctl} name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} className="min-h-11 tnum" />}
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending} aria-busy={pending}>{c.joinTeamAction}</Button>
      </div>
    </form>
  );
}
