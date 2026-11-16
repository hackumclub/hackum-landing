import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { responsesToCsv } from "@/lib/forms/csv";
import { formDefinition, listResponses, orphanKeys, type FormId } from "@/lib/mockdb/forms";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { requireStaffAction } from "@/lib/server/session";
import { toUbInput } from "@/lib/time";

const ID = /^(?:membership_application|join|event:[A-Za-z0-9_-]{1,64})$/;
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const;
const plain = (status: number, body: string) => new Response(body, { status, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return ""; } };

/**
 * Staff export of one form's responses. Authorised here, not only on the page: 401 signed out, 403 signed in but not
 * staff, 404 for an unknown or malformed id. Names only, never emails (see `responsesToCsv`). `?lang=en|mn` picks the
 * column language.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!mockEnabled()) return plain(404, "Not found");
  const who = await requireStaffAction();
  if (!who.ok) return who.error === "unauthenticated" ? plain(401, "Sign in to export") : plain(403, "Staff only");
  const id = safeDecode((await params).id);
  if (!ID.test(id)) return plain(404, "Not found");

  const store = getStore();
  const db = store.read();
  const def = formDefinition(db, id as FormId);
  const rows = def ? listResponses(db, id as FormId) : null;
  if (!def || !rows) return plain(404, "Not found");

  const asked = new URL(req.url).searchParams.get("lang") ?? undefined;
  const lang: Locale = isLocale(asked) ? asked : DEFAULT_LOCALE;
  const csv = responsesToCsv(def.questions, rows, lang, orphanKeys(def.questions, rows));
  // The id is validated above, so the filename only needs its colon replaced.
  const name = `hackum-${id.replace(/[^A-Za-z0-9_-]/g, "-")}-${toUbInput(store.now()).slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: { ...HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"` },
  });
}
