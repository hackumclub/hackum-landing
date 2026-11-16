// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorCode, Result } from "@/lib/result";
import type { Ctx, Db } from "@/lib/mockdb/types";
import { createPoll, setPollStatus, type PollInput } from "@/lib/mockdb/polls";
import { pollMessage, pollsCopy } from "@/components/me/polls/copy";
import { addProfile, addStaff, at, ctx as mkCtx, emptyDb } from "./helpers/fixture";

let db: Db;
let actor: string | null = "me";
let forced: ErrorCode | null = null;
vi.mock("@/lib/server/session", () => ({
  act: async <T,>(rule: (c: Ctx) => Result<T>) => (forced ? { ok: false, error: forced } : rule(mkCtx(db, actor))),
}));
const { votePollAction } = await import("@/lib/me/poll-actions");

const CODES: ErrorCode[] = ["unauthenticated", "forbidden", "not_found", "invalid", "conflict", "full", "closed", "rate_limited", "ineligible", "server"];
let pollId = "";
const input = (over: Partial<PollInput> = {}): PollInput => ({
  title: { mn: "Сэдэв?", en: "Topic?" }, description: { mn: "", en: "" },
  options: [{ id: "a", label: { mn: "A", en: "A" } }, { id: "b", label: { mn: "B", en: "B" } }, { id: "c", label: { mn: "C", en: "C" } }],
  multi: true, max_choices: 2, audience: "members", anonymous: true, results: "after_vote", opens_at: null, closes_at: null, ...over,
});
const make = (over: Partial<PollInput> = {}) => {
  const r = createPoll(mkCtx(db, "org"), input(over));
  if (!r.ok) throw new Error(r.error);
  setPollStatus(mkCtx(db, "org"), r.data.id, "published");
  return r.data.id;
};

beforeEach(() => {
  db = emptyDb(); actor = "me"; forced = null;
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "me", status: "member" });
  addProfile(db, { id: "guest", status: "guest" });
  pollId = make();
});

describe("messages", () => {
  it("has a sentence for every error code in both languages and never the code", () => {
    for (const lang of ["mn", "en"] as const) {
      expect(Object.keys(pollsCopy[lang].errors).sort()).toEqual([...CODES].sort());
      for (const code of CODES) {
        const m = pollMessage(code, lang);
        expect(m.trim().length, `${lang}/${code}`).toBeGreaterThan(8);
        expect(m).not.toBe(code);
      }
    }
    expect(pollMessage("forbidden", "en")).toBe("This poll is for members");
  });
});

describe("votePollAction", () => {
  it("records the ballot and a second call changes it", async () => {
    expect(await votePollAction("en", { pollId, optionIds: ["a", "b"] })).toEqual({ ok: true, data: undefined });
    expect(db.poll_votes).toHaveLength(1);
    await votePollAction("en", { pollId, optionIds: ["c"] });
    expect(db.poll_votes).toHaveLength(1);
    expect(db.poll_votes[0].option_ids).toEqual(["c"]);
  });

  it("signed out: unauthenticated", async () => {
    actor = null;
    expect(await votePollAction("en", { pollId, optionIds: ["a"] })).toMatchObject({ ok: false, error: "unauthenticated" });
  });

  it("a guest voting in a members poll gets 'This poll is for members'", async () => {
    actor = "guest";
    expect(await votePollAction("en", { pollId, optionIds: ["a"] })).toEqual({ ok: false, error: "forbidden", message: "This poll is for members" });
    expect(db.poll_votes).toEqual([]);
  });

  it("closed poll and unknown poll", async () => {
    setPollStatus(mkCtx(db, "org"), pollId, "closed");
    expect(await votePollAction("en", { pollId, optionIds: ["a"] })).toMatchObject({ ok: false, error: "closed", message: "This poll is closed" });
    expect(await votePollAction("en", { pollId: "nope", optionIds: ["a"] })).toMatchObject({ ok: false, error: "not_found" });
  });

  it("more than the allowed choices, unknown or duplicate options: invalid (rule), nothing stored", async () => {
    for (const optionIds of [["a", "b", "c"], ["zzz"], ["a", "a"]]) {
      expect(await votePollAction("en", { pollId, optionIds })).toMatchObject({ ok: false, error: "invalid" });
    }
    expect(db.poll_votes).toEqual([]);
  });

  it.each([
    ["no options", { optionIds: [] }], ["more than ten", { optionIds: Array.from({ length: 11 }, (_, i) => `o${i}`) }],
    ["option not text", { optionIds: [1] }], ["options not an array", { optionIds: "a" }], ["empty poll id", { pollId: "" }], ["poll id object", { pollId: { $ne: 1 } }],
  ])("zod rejects %s", async (_n, over) => {
    expect(await votePollAction("en", { pollId, optionIds: ["a"], ...over })).toMatchObject({ ok: false, error: "invalid" });
    expect(db.poll_votes).toEqual([]);
  });

  it("rejects non-object input", async () => {
    expect(await votePollAction("en", undefined)).toMatchObject({ ok: false, error: "invalid" });
  });

  it.each(CODES)("maps a rule failure with %s to a sentence", async (code) => {
    forced = code;
    const r = await votePollAction("mn", { pollId, optionIds: ["a"] });
    expect(r).toMatchObject({ ok: false, error: code });
    if (!r.ok) expect(r.message).toBe(pollMessage(code, "mn"));
  });

  it("an open window that has not started yet is closed to voting", async () => {
    const later = make({ opens_at: at(5) });
    expect(await votePollAction("en", { pollId: later, optionIds: ["a"] })).toMatchObject({ ok: false, error: "closed" });
  });
});
