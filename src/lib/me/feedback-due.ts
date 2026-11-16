// Which finished events a person may still give feedback on. Pure read side over a Db: the write rules (and the real
// window check) live in src/lib/mockdb/feedback.ts; this mirrors them so the UI never offers a button the rule would refuse.
import type { L } from "@/i18n/config";
import { FEEDBACK_WINDOW_MS, myFeedback } from "@/lib/mockdb/feedback";
import type { Db, EventFeedback, EventRow } from "@/lib/mockdb/types";

export type FeedbackAccess = {
  /** none: this person cannot answer this event at all (not completed, did not come); open: answers accepted; closed: the 14 days are over. */
  state: "none" | "open" | "closed";
  /** The person's own answer, if any. Never anyone else's. */
  answer: EventFeedback | null;
  /** ISO time the survey closes (event end + 14 days). */
  closesAt: string;
};

export type FeedbackDueItem = { id: string; slug: string; title: L; cover: string | null; ends_at: string; closesAt: string };
export type FeedbackCardState = "give" | "edit" | "thanks" | null;

export function feedbackAccess(db: Db, ev: EventRow, profileId: string, now: Date): FeedbackAccess {
  const end = new Date(ev.ends_at).getTime();
  const closesAt = new Date(end + FEEDBACK_WINDOW_MS).toISOString();
  const answer = myFeedback(db, ev.id, profileId);
  const person = db.profiles.find((p) => p.id === profileId && !p.deleted_at);
  const came = db.registrations.some((r) => r.event_id === ev.id && r.profile_id === profileId && (r.status === "attended" || r.status === "going"));
  if (!person || !came || ev.status !== "completed" || now.getTime() < end) return { state: "none", answer, closesAt };
  return { state: now.getTime() <= end + FEEDBACK_WINDOW_MS ? "open" : "closed", answer, closesAt };
}

/** Events to ask about on Home: open window, no answer yet, the survey that closes first on top. */
export function feedbackDue(db: Db, profileId: string, now: Date): FeedbackDueItem[] {
  return db.events
    .map((ev) => ({ ev, access: feedbackAccess(db, ev, profileId, now) }))
    .filter(({ access }) => access.state === "open" && !access.answer)
    .sort((a, b) => a.access.closesAt.localeCompare(b.access.closesAt))
    .map(({ ev, access }) => ({ id: ev.id, slug: ev.slug, title: ev.title, cover: ev.cover_path, ends_at: ev.ends_at, closesAt: access.closesAt }));
}

/** What the Past tab card offers: a first answer, an edit, a quiet thank-you once closed, or nothing. */
export function feedbackCardState(db: Db, eventId: string, profileId: string, now: Date): FeedbackCardState {
  const ev = db.events.find((e) => e.id === eventId);
  if (!ev) return null;
  const a = feedbackAccess(db, ev, profileId, now);
  if (a.state === "open") return a.answer ? "edit" : "give";
  if (a.state === "closed" && a.answer) return "thanks";
  return null;
}
