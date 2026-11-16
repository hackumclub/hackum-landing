// The one-line "what changed" under each audit row: "Draft → Published", "role: organizer → admin". Built from the
// raw `diff` of the audit entry so the log is readable without opening every row (audit F-25).
import { diffPairs } from "@/lib/members/format";

const MAX_PARTS = 2;
const isEmpty = (v: unknown) => v === null || v === undefined || v === "";

/**
 * `fmt` turns a raw value into words (a status into its label, an ISO date into a date); `label` names a key. A status
 * change drops the label because the two words already say what changed. A change from nothing reads as "set".
 */
export function buildChangeLine(
  diff: Record<string, unknown>,
  { fmt, label, more }: { fmt: (key: string, value: unknown) => string; label: (key: string) => string; more: (n: number) => string },
): string | null {
  const parts = diffPairs(diff).map((p) => {
    const head = p.key === "status" ? "" : `${label(p.key)}: `;
    if (p.changed && !isEmpty(p.before)) return `${head}${fmt(p.key, p.before)} → ${fmt(p.key, p.after)}`;
    return `${head}${fmt(p.key, p.after)}`;
  });
  if (parts.length === 0) return null;
  const shown = parts.slice(0, MAX_PARTS);
  if (parts.length > MAX_PARTS) shown.push(more(parts.length - MAX_PARTS));
  return shown.join(" · ");
}
