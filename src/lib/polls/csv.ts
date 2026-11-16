import type { Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-polls";
import { csvCell } from "@/lib/csv-cell";
import type { PollResultsView } from "@/lib/mockdb/polls";
import type { Poll } from "@/lib/mockdb/types";

const lab = (l: { mn: string; en: string }, lang: Locale) => (lang === "en" && l.en.trim() ? l.en : l.mn);

/**
 * Staff export of a poll's results: one block of totals per option, then (only for non-anonymous polls) one row per
 * voter. UTF-8 with BOM (Excel), CRLF, RFC 4180 quoting, formula-safe (a poll title or a person's name may start with "=").
 * Anonymous polls never get a voter block: `voterList` is null for them and nothing here can add it back.
 */
export function pollResultsToCsv(poll: Poll, view: Pick<PollResultsView, "tallies" | "voters" | "voterList">, lang: Locale): string {
  const h = copy[lang].results.csv;
  const optionLabel = new Map(poll.options.map((o) => [o.id, lab(o.label, lang)]));
  const share = (n: number) => (view.voters > 0 ? `${Math.round((n / view.voters) * 100)}%` : "0%");
  const lines: string[][] = [[lab(poll.title, lang)], [h.option, h.votes, h.share]];
  for (const t of view.tallies ?? []) lines.push([optionLabel.get(t.option_id) ?? t.option_id, String(t.votes), share(t.votes)]);
  if (view.voterList) {
    lines.push([], [h.voter, h.choices]);
    for (const v of view.voterList) lines.push([lab(v.name, lang) || v.profile_id, v.option_ids.map((id) => optionLabel.get(id) ?? id).join("; ")]);
  } else {
    lines.push([], [h.anonymousNote]);
  }
  return `\uFEFF${lines.map((l) => l.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
