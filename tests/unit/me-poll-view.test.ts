// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { createPoll, setPollStatus, vote, type PollInput } from "@/lib/mockdb/polls";
import { openPollToAnswer, pollCards } from "@/lib/me/poll-view";
import { addProfile, addStaff, at, ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
const input = (over: Partial<PollInput> = {}): PollInput => ({
  title: { mn: "Сэдэв?", en: "Topic?" }, description: { mn: "", en: "" },
  options: [{ id: "a", label: { mn: "A", en: "A" } }, { id: "b", label: { mn: "B", en: "B" } }, { id: "c", label: { mn: "C", en: "C" } }],
  multi: false, max_choices: 1, audience: "members", anonymous: true, results: "after_vote", opens_at: null, closes_at: null, ...over,
});
const make = (over: Partial<PollInput> = {}, publish = true) => {
  const r = createPoll(ctx(db, "org"), input(over));
  if (!r.ok) throw new Error(r.error);
  if (publish) setPollStatus(ctx(db, "org"), r.data.id, "published");
  return r.data.id;
};

beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "m", status: "member" });
  addProfile(db, { id: "g", status: "guest" });
  addProfile(db, { id: "al", status: "alumni" });
});

describe("pollCards", () => {
  it("lists only published polls the person is in the audience of (guests do not see a members poll)", () => {
    const members = make();
    make({}, false); // draft
    const everyone = make({ audience: "everyone" });
    expect(pollCards(db, "m", NOW).map((c) => c.id).sort()).toEqual([members, everyone].sort());
    expect(pollCards(db, "g", NOW).map((c) => c.id)).toEqual([everyone]);
    expect(pollCards(db, "al", NOW).map((c) => c.id)).toEqual([everyone]);
    expect(pollCards(db, "ghost", NOW)).toEqual([]);
  });

  it("staff only see what they could vote in, never drafts", () => {
    make({}, false);
    expect(pollCards(db, "org", NOW)).toEqual([]);
  });

  it("states: open, scheduled (not yet open), closed (by status or by time); open ones first, soonest closing first", () => {
    const later = make({ closes_at: at(48) });
    const sooner = make({ closes_at: at(5) });
    const scheduled = make({ opens_at: at(10), closes_at: at(60) });
    const closed = make({ closes_at: at(-5), opens_at: at(-50) });
    const byStatus = make();
    setPollStatus(ctx(db, "org"), byStatus, "closed");
    const cards = pollCards(db, "m", NOW);
    expect(Object.fromEntries(cards.map((c) => [c.id, c.state]))).toEqual({ [later]: "open", [sooner]: "open", [scheduled]: "scheduled", [closed]: "closed", [byStatus]: "closed" });
    expect(cards.slice(0, 3).map((c) => c.id)).toEqual([sooner, later, scheduled]);
    expect(cards.slice(3).every((c) => c.state === "closed")).toBe(true);
  });

  it("hides the numbers until the poll's own rule allows them, and says why", () => {
    const afterVote = make({ results: "after_vote" });
    const afterClose = make({ results: "after_close" });
    const staffOnly = make({ results: "staff_only" });
    const find = (id: string) => pollCards(db, "m", NOW).find((c) => c.id === id)!;
    expect(find(afterVote)).toMatchObject({ visible: false, hidden: "after_vote", tallies: null });
    expect(find(afterClose)).toMatchObject({ visible: false, hidden: "after_close", tallies: null });
    vote(ctx(db, "m"), { pollId: afterVote, optionIds: ["a"] });
    vote(ctx(db, "m"), { pollId: afterClose, optionIds: ["b"] });
    vote(ctx(db, "m"), { pollId: staffOnly, optionIds: ["c"] });
    expect(find(afterVote)).toMatchObject({ visible: true, hidden: null, myVote: ["a"], voters: 1 });
    expect(find(afterVote).tallies).toEqual([{ option_id: "a", votes: 1 }, { option_id: "b", votes: 0 }, { option_id: "c", votes: 0 }]);
    expect(find(afterClose)).toMatchObject({ visible: false, myVote: ["b"], tallies: null });
    expect(find(staffOnly)).toMatchObject({ visible: false, hidden: "staff_only", tallies: null, myVote: ["c"] });
  });

  it("a closed poll shows its numbers to everyone who may see it", () => {
    const id = make({ results: "after_close" });
    setPollStatus(ctx(db, "org"), id, "closed");
    expect(pollCards(db, "m", NOW).find((c) => c.id === id)).toMatchObject({ state: "closed", visible: true });
  });
});

describe("openPollToAnswer", () => {
  it("is the first open poll without a vote; null once everything is answered, closed or not for them", () => {
    expect(openPollToAnswer(db, "m", NOW)).toBeNull();
    const closed = make({ closes_at: at(-1), opens_at: at(-9) });
    const a = make({ closes_at: at(10) });
    const b = make({ closes_at: at(20) });
    expect(openPollToAnswer(db, "m", NOW)?.id).toBe(a);
    vote(ctx(db, "m"), { pollId: a, optionIds: ["a"] });
    expect(openPollToAnswer(db, "m", NOW)?.id).toBe(b);
    vote(ctx(db, "m"), { pollId: b, optionIds: ["a"] });
    expect(openPollToAnswer(db, "m", NOW)).toBeNull();
    expect(closed).toBeTruthy();
    expect(openPollToAnswer(db, "g", NOW)).toBeNull();
  });
});
