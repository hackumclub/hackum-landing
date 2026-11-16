import { err, ok, type Result } from "@/lib/result";
import type { L } from "@/i18n/config";
import { audit, enqueue, isStaff, iso, nextId, PREF_OF, profileOf, requireProfile, requireStaff } from "./core";
import type { Ctx, Db, Poll, PollAudience, PollResultsVisibility, PollStatus, Profile } from "./types";

export type PollInput = Omit<Poll, "id" | "status" | "created_by" | "created_at">;
const AUDIENCES: PollAudience[] = ["members", "community", "everyone"];
const VISIBILITY: PollResultsVisibility[] = ["after_vote", "after_close", "staff_only"];
const NEXT: Record<PollStatus, PollStatus[]> = { draft: ["published"], published: ["closed", "draft"], closed: ["published"] };

const validDate = (v: string | null) => v === null || !Number.isNaN(new Date(v).getTime());
function valid(i: PollInput): boolean {
  if (!i.title.mn.trim() || i.title.mn.length > 200 || i.title.en.length > 200 || i.description.mn.length > 2000 || i.description.en.length > 2000) return false;
  if (i.options.length < 2 || i.options.length > 10) return false;
  const ids = new Set<string>();
  for (const o of i.options) {
    if (!/^[a-z0-9_-]{1,24}$/.test(o.id) || ids.has(o.id) || !o.label.mn.trim() || o.label.mn.length > 120 || o.label.en.length > 120) return false;
    ids.add(o.id);
  }
  if (i.multi ? !Number.isInteger(i.max_choices) || i.max_choices < 1 || i.max_choices > i.options.length : i.max_choices !== 1) return false;
  if (!AUDIENCES.includes(i.audience) || !VISIBILITY.includes(i.results)) return false;
  if (!validDate(i.opens_at) || !validDate(i.closes_at)) return false;
  if (i.opens_at && i.closes_at && new Date(i.closes_at) <= new Date(i.opens_at)) return false;
  return true;
}

export const eligibleFor = (poll: Poll, p: Profile) =>
  !p.deleted_at && !!p.onboarded_at && (poll.audience === "everyone" || (poll.audience === "members" ? p.status === "member" : p.status === "member" || p.status === "alumni"));
const audienceOf = (db: Db, poll: Poll) => db.profiles.filter((p) => eligibleFor(poll, p));
const hasEnded = (poll: Poll, now: Date) => poll.status === "closed" || (!!poll.closes_at && now >= new Date(poll.closes_at));
export const isOpen = (poll: Poll, now: Date) => poll.status === "published" && (!poll.opens_at || now >= new Date(poll.opens_at)) && !hasEnded(poll, now);
const pollOf = (db: Db, id: string) => db.polls.find((p) => p.id === id) ?? null;

export function createPoll(ctx: Ctx, input: PollInput): Result<{ id: string }> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  if (!valid(input)) return err("invalid");
  const row: Poll = { ...structuredClone(input), id: nextId(ctx.db, "poll"), status: "draft", created_by: staff.data.id, created_at: iso(ctx.now) };
  ctx.db.polls.push(row);
  audit(ctx, "poll.create", "polls", row.id);
  return ok({ id: row.id });
}

export function updatePoll(ctx: Ctx, id: string, input: PollInput): Result<void> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const poll = pollOf(ctx.db, id);
  if (!poll) return err("not_found");
  if (!valid(input)) return err("invalid");
  if (ctx.db.poll_votes.some((v) => v.poll_id === id)) {
    // Once people have voted the ballot itself is frozen; wording and the closing time may still change.
    const same = poll.options.length === input.options.length && poll.options.every((o, i) => o.id === input.options[i].id);
    if (!same || poll.multi !== input.multi || poll.max_choices !== input.max_choices || poll.audience !== input.audience || poll.anonymous !== input.anonymous) return err("conflict");
  }
  Object.assign(poll, structuredClone(input));
  audit(ctx, "poll.update", "polls", id);
  return ok(undefined);
}

export function setPollStatus(ctx: Ctx, id: string, status: PollStatus): Result<{ notified: number }> {
  const staff = requireStaff(ctx);
  if (!staff.ok) return staff;
  const poll = pollOf(ctx.db, id);
  if (!poll) return err("not_found");
  if (!NEXT[poll.status].includes(status)) return err("conflict");
  if (status === "draft" && ctx.db.poll_votes.some((v) => v.poll_id === id)) return err("conflict");
  const from = poll.status;
  poll.status = status;
  let notified = 0;
  if (status === "published") {
    for (const p of audienceOf(ctx.db, poll)) {
      const pref = PREF_OF.poll_opened;
      if (pref && !p.notif_prefs[pref]) continue;
      // Deduped per poll and person: closing and re-opening a poll never mails anyone twice.
      if (enqueue(ctx, { profileId: p.id, template: "poll_opened", priority: 2, payload: { to_name: p.name.mn || p.name.en, poll_id: poll.id, poll_title_mn: poll.title.mn, poll_title_en: poll.title.en }, dedupe: `poll:${poll.id}:${p.id}` })) notified++;
    }
  }
  audit(ctx, "poll.status", "polls", id, { status: [from, status] });
  return ok({ notified });
}

export function vote(ctx: Ctx, input: { pollId: string; optionIds: string[] }): Result<void> {
  const me = requireProfile(ctx, { onboarded: true });
  if (!me.ok) return me;
  const poll = pollOf(ctx.db, input.pollId);
  if (!poll || poll.status === "draft") return err("not_found");
  if (!isOpen(poll, ctx.now)) return err("closed");
  if (!eligibleFor(poll, me.data)) return err("forbidden");
  const ids = input.optionIds;
  const known = new Set(poll.options.map((o) => o.id));
  if (ids.length < 1 || ids.length > (poll.multi ? poll.max_choices : 1) || new Set(ids).size !== ids.length || ids.some((x) => !known.has(x))) return err("invalid");
  const row = ctx.db.poll_votes.find((v) => v.poll_id === poll.id && v.profile_id === me.data.id);
  if (row) Object.assign(row, { option_ids: [...ids], updated_at: iso(ctx.now) });
  else ctx.db.poll_votes.push({ poll_id: poll.id, profile_id: me.data.id, option_ids: [...ids], created_at: iso(ctx.now), updated_at: iso(ctx.now) });
  return ok(undefined);
}

export type PollResultsView = {
  poll: Poll; open: boolean; visible: boolean; tallies: { option_id: string; votes: number }[] | null;
  voters: number; eligible: number; turnout: number | null; myVote: string[] | null;
  /** Only staff, only on a poll that is not anonymous. */ voterList: { profile_id: string; name: L; option_ids: string[] }[] | null;
};

export function pollResults(db: Db, pollId: string, viewer: string | null, now: Date): PollResultsView | null {
  const poll = pollOf(db, pollId);
  const staff = isStaff(db, viewer);
  if (!poll || (poll.status === "draft" && !staff)) return null;
  const votes = db.poll_votes.filter((v) => v.poll_id === poll.id);
  const mine = viewer ? votes.find((v) => v.profile_id === viewer) ?? null : null;
  const ended = hasEnded(poll, now);
  const visible = staff || (poll.results === "after_vote" ? !!mine || ended : poll.results === "after_close" ? ended : false);
  const eligible = audienceOf(db, poll).length;
  return {
    poll, open: isOpen(poll, now), visible,
    tallies: visible ? poll.options.map((o) => ({ option_id: o.id, votes: votes.filter((v) => v.option_ids.includes(o.id)).length })) : null,
    voters: votes.length, eligible, turnout: eligible ? votes.length / eligible : null, myVote: mine ? [...mine.option_ids] : null,
    voterList: staff && !poll.anonymous ? votes.map((v) => ({ profile_id: v.profile_id, name: profileOf(db, v.profile_id)?.name ?? { mn: "", en: "" }, option_ids: [...v.option_ids] })) : null,
  };
}

/** Polls a person can see: staff everything; others published and closed polls they are in the audience of. */
export function listPollsFor(db: Db, profileId: string, now: Date): { poll: Poll; open: boolean; myVote: string[] | null }[] {
  const me = profileOf(db, profileId);
  const staff = isStaff(db, profileId);
  if (!me) return [];
  return db.polls
    .filter((p) => (staff ? true : p.status !== "draft" && eligibleFor(p, me)))
    .map((poll, i) => ({ poll, i, open: isOpen(poll, now), myVote: db.poll_votes.find((v) => v.poll_id === poll.id && v.profile_id === profileId)?.option_ids ?? null }))
    .sort((a, b) => b.poll.created_at.localeCompare(a.poll.created_at) || b.i - a.i)
    .map(({ poll, open, myVote }) => ({ poll, open, myVote }));
}
