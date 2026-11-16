// Pure: the filters the dashboard's "Needs attention" rows deep-link to (/admin/events?filter=…). Kept out of the client
// component so the server page can import the list of names.
import type { EventStatus } from "@/lib/status";

export type PresetRow = { stored: EventStatus; applied: number; cover: string | null; noEnTitle: boolean };

export type Preset = "applications" | "missing_cover" | "needs_en";
export const PRESETS: Preset[] = ["applications", "missing_cover", "needs_en"];

const live = (r: PresetRow) => r.stored === "draft" || r.stored === "published";

/** Mirrors attentionCounts() in the mock queries, so the number on the dashboard equals the rows you land on. */
export const PRESET_TEST: Record<Preset, (r: PresetRow) => boolean> = {
  applications: (r) => r.stored === "published" && r.applied > 0,
  missing_cover: (r) => live(r) && !r.cover,
  needs_en: (r) => live(r) && r.noEnTitle,
};
