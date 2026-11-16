import { CheckCircle2, CircleDashed, TriangleAlert, XCircle } from "lucide-react";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import StatusPill from "@/components/ui/StatusPill";
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

/** Integration states reuse shared pill tones: simulated = neutral, connected = ok, misconfigured = warn, failing = danger. */
const PILL: Record<"simulated" | "connected" | "misconfigured" | "failing", Status> = { simulated: "withdrawn", connected: "going", misconfigured: "pending", failing: "rejected" };
const STATE_ICON = { connected: CheckCircle2, misconfigured: TriangleAlert, failing: XCircle } as const;

export default function IntegrationCards({ c, envSet }: { c: AreaCopy["settings"]["integrations"]; envSet: Record<string, boolean> }) {
  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-sm text-fg-muted">{c.lead}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {KEYS.map((k) => (
          <li key={k} className="grid content-start gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-fg">{c.cards[k].name}</h2>
              <StatusPill status={PILL.simulated} label={c.mode} />
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

      <section aria-labelledby="legend" className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4">
        <div className="grid gap-0.5">
          <h2 id="legend" className="font-display text-base font-bold text-fg">{c.legendTitle}</h2>
          <p className="text-sm text-fg-muted">{c.legendLead}</p>
        </div>
        <ul className="grid gap-2 md:grid-cols-3">
          {(["connected", "misconfigured", "failing"] as const).map((s) => {
            const Icon = STATE_ICON[s];
            return (
              <li key={s} className="grid content-start gap-1.5 rounded-[var(--radius-sm)] border border-line bg-panel-2 p-3">
                <span className="inline-flex items-center gap-2"><Icon aria-hidden="true" size={16} className="text-fg-muted" /><StatusPill status={PILL[s]} label={c.states[s]} /></span>
                <p className="text-sm text-fg-muted">{c.stateLines[s]}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
