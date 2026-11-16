import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/admin-events";
import { isLocale, tf } from "@/i18n/config";
import { registrationsCsv } from "@/lib/events/csv";
import { buildRegistrations } from "@/lib/events/admin-registrations";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { requireStaffAction } from "@/lib/server/session";

/**
 * CSV of one event's registrations for organizers (UTF-8 with BOM so Excel shows Cyrillic). Staff only: anyone else gets
 * the ordinary 404 so the backoffice stays invisible. Column headers and answers use the active language.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ lang: string; id: string }> }) {
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!mockEnabled()) return notFound();
  const who = await requireStaffAction();
  const { lang, id } = await params;
  if (!who.ok || !isLocale(lang)) return notFound();
  const db = getStore().read();
  const event = db.events.find((e) => e.id === id);
  if (!event) return notFound();

  const t = copy[lang].regs;
  const d = getDictionary(lang);
  const application = event.reg_mode === "application";
  const { rows, teams } = buildRegistrations(db, id);
  const teamName = new Map(teams.map((x) => [x.id, x.name]));
  const csv = registrationsCsv({
    questions: event.questions, lang,
    labels: { name: t.cols.person, school: t.cols.school, status: t.cols.status, team: t.cols.team, applied: t.cols.applied, yes: t.drawer.yes, no: t.drawer.no },
    rows: rows.map((r) => ({
      name: tf(r.name, lang), school: r.school, status: application && r.status === "going" ? t.accepted : d.status[r.status],
      team: r.teamId ? teamName.get(r.teamId) ?? null : null, createdAt: r.createdAt, answers: r.answers,
    })),
  });
  // Slugs are validated to [a-z0-9-], so the filename needs no escaping; the guard keeps header injection impossible regardless.
  const slug = event.slug.replace(/[^a-z0-9-]/g, "");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-registrations.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
