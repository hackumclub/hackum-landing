import type { L } from "@/i18n/config";
import type { ListState } from "@/lib/admin/list-state";
import { PREF_OF } from "@/lib/mockdb/core";
import { eligibleFor, isOpen } from "@/lib/mockdb/polls";
import type { Db, Poll, PollAudience, PollStatus } from "@/lib/mockdb/types";

export type PollPhase = "draft" | "scheduled" | "open" | "closed";
export const POLL_STATUSES: PollStatus[] = ["draft", "published", "closed"];

/** What a person would call the poll's state right now: a published poll can be scheduled, open, or already over by its closing time. */
export function pollPhase(poll: Poll, now: Date): PollPhase {
  if (poll.status === "draft") return "draft";
  if (poll.status === "closed" || (poll.closes_at !== null && now >= new Date(poll.closes_at))) return "closed";
  return isOpen(poll, now) ? "open" : "scheduled";
}

export type PollRow = {
  id: string; title: L; audience: PollAudience; anonymous: boolean; stored: PollStatus; phase: PollPhase;
  voters: number; eligible: number; closesAt: string | null; createdAt: string;
};

/** Staff list rows, newest first. Turnout counts the same ballots and audience as the results tab. */
export function pollRows(db: Db, now: Date): PollRow[] {
  return db.polls
    .map((poll, i) => {
      return {
        i, row: {
          id: poll.id, title: poll.title, audience: poll.audience, anonymous: poll.anonymous, stored: poll.status, phase: pollPhase(poll, now),
          voters: db.poll_votes.filter((v) => v.poll_id === poll.id).length, eligible: audienceSize(db, poll.audience), closesAt: poll.closes_at, createdAt: poll.created_at,
        } satisfies PollRow,
      };
    })
    .sort((a, b) => b.row.createdAt.localeCompare(a.row.createdAt) || b.i - a.i)
    .map((x) => x.row);
}

/** People who could vote if the audience were `audience` (the plain-language "N people can vote"). */
export const audienceSize = (db: Db, audience: PollAudience): number => db.profiles.filter((p) => eligibleFor({ audience } as Poll, p)).length;

/**
 * How many people publishing would actually notify: the audience, minus anyone who switched announcements off and anyone
 * already notified about this poll (publishing, closing and reopening never mails twice). Same rule as `setPollStatus`.
 */
export function notifyCount(db: Db, poll: Poll): number {
  const pref = PREF_OF.poll_opened;
  return db.profiles.filter((p) => eligibleFor(poll, p) && !(pref && !p.notif_prefs[pref]) && !db.notifications.some((n) => n.dedupe_key === `poll:${poll.id}:${p.id}`)).length;
}

export type AudienceCounts = Record<PollAudience, number>;
export const audienceCounts = (db: Db): AudienceCounts => ({ members: audienceSize(db, "members"), community: audienceSize(db, "community"), everyone: audienceSize(db, "everyone") });

const norm = (s: string) => s.toLowerCase().trim();
export function filterPolls(rows: PollRow[], s: ListState): PollRow[] {
  const status = s.multi.status ?? [];
  const q = norm(s.q);
  return rows.filter((r) => (status.length === 0 || status.includes(r.stored)) && (q === "" || norm(r.title.mn).includes(q) || norm(r.title.en).includes(q)));
}
