// Public event shapes. The data comes from the mock database through src/lib/public/*; this file only holds the
// types the public components consume (the same fields the static list had, plus what the database adds).
import type { L } from "@/i18n/config";
import type { StickerName } from "@/lib/manul";
import type { EventAudience, RegMode } from "@/lib/mockdb/types";

export type Event = {
  slug: string;
  name: L;
  tagline: L;
  /** Year in Ulaanbaatar time, as text ("2026"). */
  year: string;
  /** "Offline" | "Online" | "Hybrid": a key into the ticket dictionary's `modes`. */
  mode: string;
  /** Event kind as a key into the ticket dictionary's `kinds` ("Hackathon", "Competition", "Workshop", …). */
  themes: string[];
  /** "Ended" or a key into the ticket dictionary's `statuses` ("Live" | "Open" | "Full" | "Soon" | "Cancelled"). */
  status: string;
  participants: number | null;
  /** Where the "see it on Instagram" button goes; empty when there is nothing to link to. */
  url: string;
  sticker: StickerName;
};

/** Everything the event page needs. Never contains the online link: that is revealed per viewer. */
export type EventDetail = Event & {
  id: string;
  description: L;
  startsAt: string;
  endsAt: string;
  approximateDate: boolean;
  venue: string | null;
  address: string | null;
  audience: EventAudience;
  regMode: RegMode;
  capacity: number | null;
  waitlist: boolean;
  regOpensAt: string | null;
  regClosesAt: string | null;
  decisionDeadline: string | null;
  cancelled: boolean;
};
