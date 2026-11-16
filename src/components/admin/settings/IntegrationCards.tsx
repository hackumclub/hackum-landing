import { CheckCircle2, CircleDashed, TriangleAlert, XCircle } from "lucide-react";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import Icon3D from "@/components/Icon3D";
import StatusPill from "@/components/ui/StatusPill";
import { CARD } from "@/components/admin/members/card";
import { cx } from "@/components/ui/cx";
import type { Status } from "@/lib/status";

export type IntegrationKey = "clerk" | "supabase" | "resend" | "cron" | "realtime";
/** Variable NAMES per integration (spec §9). Only whether each is set is read: values never leave the server. */
export const INTEGRATION_ENV: Record<IntegrationKey, string[]> = {
  clerk: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET"],
  supabase: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"],
  resend: ["RESEND_API_KEY", "RESEND_WEBHOOK_SIGNING_SECRET".replace("SIGNING_", ""), "EMAIL_FROM"],
  cron: ["CRON_SECRET"],
  realtime: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
};
const KEYS = Object.keys(INTEGRATION_ENV) as IntegrationKey[];
/** Decorative 3D icon per integration (passkey = sign-in, lock = database rules, mail, clock = jobs, wifi = live updates). */
const ICON: Record<IntegrationKey, { name: string; wash: string }> = {
  clerk: { name: "passkey", wash: "var(--ops-accent-soft)" },
  supabase: { name: "lock", wash: "var(--ops-ok-soft)" },
  resend: { name: "mail", wash: "var(--ops-ember-soft)" },
  cron: { name: "clock", wash: "var(--ops-warn-soft)" },
  realtime: { name: "wifi", wash: "var(--ops-accent-soft)" },
};

/** Integration states reuse shared pill tones: simulated = neutral, connected = ok, misconfigured = warn, failing = danger. */
const PILL: Record<"simulated" | "connected" | "misconfigured" | "failing", Status> = { simulated: "withdrawn", connected: "going", misconfigured: "pending", failing: "rejected" };
const STATE_ICON = { connected: CheckCircle2, misconfigured: TriangleAlert, failing: XCircle } as const;

export default function IntegrationCards({ c, envSet }: { c: AreaCopy["settings"]["integrations"]; envSet: Record<string, boolean> }) {
  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-sm text-fg-muted">{c.lead}</p>

      <section aria-labelledby="legend" className={cx(CARD, "grid gap-3 p-4 md:p-5")}>
        <div className="grid gap-0.5">
          <h2 id="legend" className="font-display text-base font-bold text-fg">{c.legendTitle}</h2>
          <p className="text-sm text-fg-muted">{c.legendLead}</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {(["simulated", "connected", "misconfigured", "failing"] as const).map((s) => {
            const Icon = s === "simulated" ? CircleDashed : STATE_ICON[s];
            return (
              <li key={s} className="grid content-start gap-1.5 rounded-[var(--radius-sm)] bg-panel-2 p-3">
                <span className="inline-flex items-center gap-2"><Icon aria-hidden="true" size={16} className="text-fg-muted" /><StatusPill status={PILL[s]} label={c.states[s]} /></span>
                <p className="text-sm text-fg-muted">{c.stateLines[s]}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <ul className="grid gap-3 md:grid-cols-2">
        {KEYS.map((k) => (
          <li key={k} className={cx(CARD, "relative grid content-start gap-4 overflow-hidden p-4 md:p-5")} style={{ backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${ICON[k].wash}, transparent 60%)` }}>
            <div className="flex items-center gap-3">
              <Icon3D name={ICON[k].name} sizes="80px" className="size-14 shrink-0 -rotate-3 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)] md:size-16" />
              <div className="grid min-w-0 flex-1 justify-items-start gap-1.5">
                <h2 className="font-display text-lg font-bold text-fg">{c.cards[k].name}</h2>
                <StatusPill status={PILL.simulated} label={c.mode} />
              </div>
            </div>
            <div className="grid gap-1">
              <p className="text-xs font-semibold text-fg-muted">{c.willDo}</p>
              <p className="text-sm text-fg">{c.cards[k].does}</p>
            </div>
            <div className="grid gap-1.5">
              <p className="text-xs font-semibold text-fg-muted">{c.configure}</p>
              <ul className="grid gap-1.5">
                {INTEGRATION_ENV[k].map((name) => (
                  <li key={name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs break-all text-fg">{name}</code>
                    <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                      {envSet[name] ? <CheckCircle2 aria-hidden="true" size={13} className="text-ok-fg" /> : <CircleDashed aria-hidden="true" size={13} />}
                      {envSet[name] ? c.envSet : c.envUnset}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-fg-muted">{c.notReal} {c.envNote}</p>
    </div>
  );
}
