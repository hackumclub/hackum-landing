// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { createPoll, listPollsFor, pollResults, setPollStatus, updatePoll, vote, type PollInput } from "@/lib/mockdb/polls";
import { inboxFor } from "@/lib/mockdb/notifications";
import { addProfile, addStaff, at, ctx, emptyDb, NOW, queued } from "./helpers/fixture";

let db: Db;
const input = (over: Partial<PollInput> = {}): PollInput => ({
  title: { mn: "Дараагийн сэдэв?", en: "Next topic?" }, description: { mn: "", en: "" },
  options: [{ id: "a", label: { mn: "AI", en: "AI" } }, { id: "b", label: { mn: "Вэб", en: "Web" } }, { id: "c", label: { mn: "Аюулгүй байдал", en: "Security" } }],
  multi: false, max_choices: 1, audience: "members", anonymous: true, results: "after_vote", opens_at: null, closes_at: null, ...over,
});
const make = (over: Partial<PollInput> = {}, publish = true) => {
  const r = createPoll(ctx(db, "org"), input(over));
  if (!r.ok) throw new Error(r.error);
  if (publish) setPollStatus(ctx(db, "org"), r.data.id, "published");
  return r.data.id;
};
const cast = (actor: string | null, pollId: string, optionIds: string[], now: Date = NOW) => vote(ctx(db, actor, now), { pollId, optionIds });

beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "m1", status: "member" }); addProfile(db, { id: "m2", status: "member" });
  addProfile(db, { id: "al", status: "alumni" }); addProfile(db, { id: "g", status: "guest" });
});

describe("creating and publishing", () => {
  it("is staff only and starts as a draft", () => {
    expect(createPoll(ctx(db, "m1"), input())).toEqual({ ok: false, error: "forbidden" });
    const id = make({}, false);
    expect(db.polls.find((p) => p.id === id)!.status).toBe("draft");
    expect(cast("m1", id, ["a"])).toEqual({ ok: false, error: "not_found" });
  });
  it.each([
    ["one option", { options: [{ id: "a", label: { mn: "A", en: "" } }] }],
    ["eleven options", { options: Array.from({ length: 11 }, (_, i) => ({ id: `o${i}`, label: { mn: `O${i}`, en: "" } })) }],
    ["duplicate option ids", { options: [{ id: "a", label: { mn: "A", en: "" } }, { id: "a", label: { mn: "B", en: "" } }] }],
    ["blank title", { title: { mn: " ", en: "x" } }],
    ["blank option label", { options: [{ id: "a", label: { mn: "A", en: "" } }, { id: "b", label: { mn: " ", en: "" } }] }],
    ["max choices above options", { multi: true, max_choices: 9 }],
    ["closing before opening", { opens_at: at(5), closes_at: at(1) }],
    ["unknown audience", { audience: "robots" }],
  ])("rejects %s", (_n, over) => {
    expect(createPoll(ctx(db, "org"), input(over as never))).toEqual({ ok: false, error: "invalid" });
  });
  it("publishing notifies the audience once, in the app and by email, respecting the announcements preference", () => {
    db.profiles.find((p) => p.id === "m2")!.notif_prefs.announcements = false;
    const id = make({ audience: "community" });
    expect(queued(db, "poll_opened").map((n) => n.profile_id).sort()).toEqual(["al", "m1"]);
    expect(inboxFor(db, "m1", {}).some((i) => i.kind === "poll_opened")).toBe(true);
    expect(inboxFor(db, "g", {})).toHaveLength(0);
    setPollStatus(ctx(db, "org"), id, "closed"); setPollStatus(ctx(db, "org"), id, "published");
    expect(queued(db, "poll_opened")).toHaveLength(2); // re-opening does not mail again
  });
  it("only allows sensible status changes", () => {
    const id = make({}, false);
    expect(setPollStatus(ctx(db, "org"), id, "closed")).toEqual({ ok: false, error: "conflict" });
    expect(setPollStatus(ctx(db, "m1"), id, "published")).toEqual({ ok: false, error: "forbidden" });
    expect(setPollStatus(ctx(db, "org"), "nope", "published")).toEqual({ ok: false, error: "not_found" });
  });
  it("freezes the options once people have voted, but still lets staff retitle and extend", () => {
    const id = make();
    cast("m1", id, ["a"]);
    expect(updatePoll(ctx(db, "org"), id, input({ options: [{ id: "a", label: { mn: "AI", en: "" } }, { id: "z", label: { mn: "Z", en: "" } }] }))).toEqual({ ok: false, error: "conflict" });
    expect(updatePoll(ctx(db, "org"), id, input({ title: { mn: "Шинэ гарчиг", en: "" }, closes_at: at(48) })).ok).toBe(true);
  });
});

describe("voting", () => {
  it("lets an eligible member vote once and change their mind until it closes", () => {
    const id = make();
    expect(cast("m1", id, ["a"]).ok).toBe(true);
    expect(cast("m1", id, ["b"]).ok).toBe(true);
    expect(db.poll_votes).toHaveLength(1);
    expect(db.poll_votes[0].option_ids).toEqual(["b"]);
  });
  it("respects the audience", () => {
    const members = make({ audience: "members" });
    expect(cast("al", members, ["a"])).toEqual({ ok: false, error: "forbidden" });
    expect(cast("g", members, ["a"])).toEqual({ ok: false, error: "forbidden" });
    const community = make({ audience: "community" });
    expect(cast("al", community, ["a"]).ok).toBe(true);
    expect(cast("g", community, ["a"])).toEqual({ ok: false, error: "forbidden" });
    const everyone = make({ audience: "everyone" });
    expect(cast("g", everyone, ["a"]).ok).toBe(true);
    expect(cast(null, everyone, ["a"])).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("is closed before it opens, after it closes, and when staff close it", () => {
    const later = make({ opens_at: at(5) });
    expect(cast("m1", later, ["a"])).toEqual({ ok: false, error: "closed" });
    const ended = make({ closes_at: at(-1) });
    expect(cast("m1", ended, ["a"])).toEqual({ ok: false, error: "closed" });
    const id = make();
    setPollStatus(ctx(db, "org"), id, "closed");
    expect(cast("m1", id, ["a"])).toEqual({ ok: false, error: "closed" });
  });
  it("checks the ballot: known options, no repeats, at most max_choices (1 for single choice)", () => {
    const single = make();
    for (const bad of [[], ["zzz"], ["a", "b"], ["a", "a"]]) expect(cast("m1", single, bad)).toEqual({ ok: false, error: "invalid" });
    const multi = make({ multi: true, max_choices: 2 });
    expect(cast("m1", multi, ["a", "b"]).ok).toBe(true);
    expect(cast("m1", multi, ["a", "b", "c"])).toEqual({ ok: false, error: "invalid" });
  });
});

describe("results", () => {
  const voteAll = (id: string) => { cast("m1", id, ["a"]); cast("m2", id, ["a"]); };
  it("after_vote: hidden until you vote, then tallies and turnout (eligible = audience size)", () => {
    const id = make();
    expect(pollResults(db, id, "m2", NOW)).toMatchObject({ visible: false, tallies: null, eligible: 2, voters: 0 });
    cast("m1", id, ["a"]);
    const r = pollResults(db, id, "m1", NOW)!;
    expect(r).toMatchObject({ visible: true, voters: 1, eligible: 2, turnout: 0.5, myVote: ["a"] });
    expect(r.tallies).toEqual([{ option_id: "a", votes: 1 }, { option_id: "b", votes: 0 }, { option_id: "c", votes: 0 }]);
  });
  it("after_close and staff_only follow their rule; staff always see tallies", () => {
    const later = make({ results: "after_close" }); voteAll(later);
    expect(pollResults(db, later, "m1", NOW)!.visible).toBe(false);
    expect(pollResults(db, later, "org", NOW)!.visible).toBe(true);
    setPollStatus(ctx(db, "org"), later, "closed");
    expect(pollResults(db, later, "m1", NOW)!.visible).toBe(true);
    const staffOnly = make({ results: "staff_only" }); voteAll(staffOnly);
    expect(pollResults(db, staffOnly, "m1", NOW)!.visible).toBe(false);
    expect(pollResults(db, staffOnly, "org", NOW)!.visible).toBe(true);
  });
  it("never lists who voted for what on an anonymous poll; a named poll shows voters to staff only", () => {
    const anon = make({ anonymous: true }); voteAll(anon);
    expect(pollResults(db, anon, "org", NOW)!.voterList).toBeNull();
    const named = make({ anonymous: false }); voteAll(named);
    expect(pollResults(db, named, "m1", NOW)!.voterList).toBeNull();
    expect(pollResults(db, named, "org", NOW)!.voterList?.map((v) => v.profile_id).sort()).toEqual(["m1", "m2"]);
    expect(JSON.stringify(pollResults(db, anon, "org", NOW))).not.toContain("m1");
  });
  it("turnout is null with an empty audience, never NaN; unknown poll is null", () => {
    db.profiles = db.profiles.filter((p) => p.status !== "member" || p.id === "org");
    const id = make({ audience: "members" });
    expect(pollResults(db, id, "org", NOW)).toMatchObject({ eligible: 0, turnout: null });
    expect(pollResults(db, "nope", "org", NOW)).toBeNull();
  });
});

describe("listPollsFor", () => {
  it("shows people the published and closed polls they may vote in, with their own vote; staff see drafts too", () => {
    const open = make(); const hidden = make({ audience: "community" }, false); const done = make(); setPollStatus(ctx(db, "org"), done, "closed");
    cast("m1", open, ["b"]);
    const rows = listPollsFor(db, "m1", NOW);
    expect(rows.map((r) => r.poll.id).sort()).toEqual([open, done].sort());
    expect(rows.find((r) => r.poll.id === open)).toMatchObject({ open: true, myVote: ["b"] });
    expect(rows.find((r) => r.poll.id === done)).toMatchObject({ open: false });
    expect(listPollsFor(db, "org", NOW).map((r) => r.poll.id)).toContain(hidden);
    expect(listPollsFor(db, "g", NOW)).toHaveLength(0);
  });
});
