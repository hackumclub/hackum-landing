import type { L } from "@/i18n/config";
import type { EventMode } from "@/lib/mockdb/types";

export type Missing = "description" | "venue" | "cover" | "english";

/** Works for a stored event (nullable columns) and for the form state (empty strings). */
type Publishable = { title: L; description: L; mode: EventMode; venue_name: string | null; cover_path: string | null };

const blank = (s: string | null | undefined) => !s || s.trim() === "";

/**
 * What the public page would be missing if the event were published now (audit F-15). Publishing is still allowed;
 * the confirm dialog lists these so a gap is a decision, not an accident. English counts as missing when the title or a
 * written description has no English version (an empty description is reported once, as "description").
 */
export function missingForPublish(e: Publishable): Missing[] {
  const out: Missing[] = [];
  const noDescription = blank(e.description.mn) && blank(e.description.en);
  if (noDescription) out.push("description");
  if (e.mode !== "online" && blank(e.venue_name)) out.push("venue");
  if (blank(e.cover_path)) out.push("cover");
  if (blank(e.title.en) || (!noDescription && blank(e.description.en))) out.push("english");
  return out;
}
