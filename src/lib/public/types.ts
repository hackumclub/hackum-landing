import type { L } from "@/i18n/config";
import type { Shot } from "@/lib/club";

/** One person in one season, as the About page shows them. Never carries an email. */
export type Member = { id: string; name: L; role: L | null; team: string | null; season: number; photo?: string };
export type TimelineMedia = Record<number, { front: Shot; back?: Shot }>;
export type PublicAttendee = { id: string; name: L };
export type SeatInfo = { going: number; waitlisted: number; capacity: number | null; left: number | null; full: boolean };
