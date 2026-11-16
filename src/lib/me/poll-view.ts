// Read side of /me/polls and the Home "Open poll" card: plain, serialisable view models over a Db.
// Only polls the person is allowed to vote in are listed; tallies are present only when pollResults says they are visible.
import type { L } from "@/i18n/config";
import { eligibleFor, isOpen, pollResults } from "@/lib/mockdb/polls";
import type { Db, Poll, PollAudience, PollResultsVisibility } from "@/lib/mockdb/types";

export type PollState = "open" | "scheduled" | "closed";
export type PollCardVm = {
  id: string; title: L; description: L; audience: PollAudience; anonymous: boolean; multi: boolean; maxChoices: number;
  results: PollResultsVisibility; state: PollState; opensAt: string | null; closesAt: string | null;
  options: { id: string; label: L }[];
  myVote: string[] | null;
  /** Whether this viewer may see the numbers now. */
  visible: boolean;
  /** Why they cannot yet (null when visible). */
  hidden: PollResultsVisibility | null;
  tallies: { option_id: string; votes: number }[] | null;
  voters: number; eligible: number; turnout: number | null;
};

const ended = (p: Poll, now: Date) => p.status === "closed" || (!!p.closes_at && now >= new Date(p.closes_at));
const stateOf = (p: Poll, now: Date): PollState => (isOpen(p, now) ? "open" : ended(p, now) ? "closed" : "scheduled");
const time = (iso: string | null, fallback: number) => (iso ? new Date(iso).getTime() : fallback);

export function pollCards(db: Db, profileId: string, now: Date): PollCardVm[] {
  const me = db.profiles.find((p) => p.id === profileId && !p.deleted_at);
  if (!me) return [];
  const cards: PollCardVm[] = [];
  for (const poll of db.polls) {
    if (poll.status === "draft" || !eligibleFor(poll, me)) continue;
    const r = pollResults(db, poll.id, profileId, now);
    if (!r) continue;
    cards.push({
      id: poll.id, title: poll.title, description: poll.description, audience: poll.audience, anonymous: poll.anonymous, multi: poll.multi, maxChoices: poll.max_choices,
      results: poll.results, state: stateOf(poll, now), opensAt: poll.opens_at, closesAt: poll.closes_at,
      options: poll.options.map((o) => ({ id: o.id, label: o.label })), myVote: r.myVote,
      visible: r.visible, hidden: r.visible ? null : poll.results, tallies: r.tallies, voters: r.voters, eligible: r.eligible, turnout: r.turnout,
    });
  }
  // Open and scheduled: the one that closes first on top. Closed: the most recently closed on top.
  const rank = (c: PollCardVm) => (c.state === "closed" ? 1 : 0);
  return cards.sort((a, b) => rank(a) - rank(b) || (a.state === "closed"
    ? time(b.closesAt, 0) - time(a.closesAt, 0)
    : time(a.closesAt, Number.MAX_SAFE_INTEGER) - time(b.closesAt, Number.MAX_SAFE_INTEGER)));
}

/** The poll to nudge on Home: the first open one this person has not voted in. */
export const openPollToAnswer = (db: Db, profileId: string, now: Date): PollCardVm | null =>
  pollCards(db, profileId, now).find((c) => c.state === "open" && !c.myVote) ?? null;
