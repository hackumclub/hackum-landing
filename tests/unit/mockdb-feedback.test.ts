// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { enqueueFeedbackRequests, feedbackSummary, myFeedback, submitFeedback } from "@/lib/mockdb/feedback";
import { tick } from "@/lib/mockdb/outbox";
import { inboxFor } from "@/lib/mockdb/notifications";
import type { RegStatus } from "@/lib/status";
import { addEvent, addProfile, at, ctx, emptyDb, NOW, queued } from "./helpers/fixture";

let db: Db;
const reg = (event_id: string, profile_id: string, status: RegStatus) =>
  db.registrations.push({ id: `r${db.registrations.length}`, event_id, profile_id, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-200), cancelled_at: null });
const give = (actor: string | null, over: Record<string, unknown> = {}, now: Date = NOW) =>
  submitFeedback(ctx(db, actor, now), { eventId: "done", rating: 5, nps: 10, went_well: "Great talks", improve: "", anonymous: false, ...over } as never);

beforeEach(() => {
  db = emptyDb();
  for (const id of ["a", "b", "c", "d"]) addProfile(db, { id });
  addEvent(db, { id: "done", status: "completed", starts_at: at(-6), ends_at: at(-4) }); // ended 4h before NOW
  addEvent(db, { id: "soon", status: "published" });
  reg("done", "a", "attended"); reg("done", "b", "going"); reg("done", "c", "no_show"); reg("soon", "a", "going");
});

describe("who may give feedback, and when", () => {
  it("accepts attended and going people on a completed event", () => {
    expect(give("a").ok).toBe(true);
    expect(give("b", { rating: 3, nps: 7 }).ok).toBe(true);
  });
  it("refuses no-shows, strangers and signed-out visitors", () => {
    expect(give("c")).toEqual({ ok: false, error: "forbidden" });
    expect(give("d")).toEqual({ ok: false, error: "forbidden" });
    expect(give(null)).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("refuses an event that is not completed, or does not exist", () => {
    expect(give("a", { eventId: "soon" })).toEqual({ ok: false, error: "closed" });
    expect(give("a", { eventId: "nope" })).toEqual({ ok: false, error: "not_found" });
  });
  it("is open from the end of the event until 14 days later", () => {
    const day = (d: number) => new Date(new Date(at(-4)).getTime() + d * 86_400_000);
    expect(give("a", {}, day(13.9)).ok).toBe(true);
    expect(give("b", {}, day(14.1))).toEqual({ ok: false, error: "closed" });
  });
  it("lets the same person edit while the window is open: one row per person", () => {
    give("a", { rating: 2 }); give("a", { rating: 4, improve: "Shorter breaks" });
    expect(db.event_feedback).toHaveLength(1);
    expect(myFeedback(db, "done", "a")).toMatchObject({ rating: 4, improve: "Shorter breaks" });
    expect(myFeedback(db, "done", "b")).toBeNull();
  });
  it.each([
    ["rating 0", { rating: 0 }], ["rating 6", { rating: 6 }], ["fractional rating", { rating: 3.5 }],
    ["nps -1", { nps: -1 }], ["nps 11", { nps: 11 }], ["text over 1000", { went_well: "x".repeat(1001) }],
  ])("rejects %s", (_n, over) => {
    expect(give("a", over)).toEqual({ ok: false, error: "invalid" });
    expect(db.event_feedback).toHaveLength(0);
  });
});

describe("feedbackSummary", () => {
  it("reports response rate, average, distribution and NPS", () => {
    give("a", { rating: 5, nps: 10 }); give("b", { rating: 3, nps: 6 });
    const s = feedbackSummary(db, "done");
    expect(s).toMatchObject({ n: 2, eligible: 2, responseRate: 1, avgRating: 4, distribution: [0, 0, 1, 0, 1], nps: 0 });
  });
  it("NPS is promoters minus detractors as a percentage", () => {
    addProfile(db, { id: "e" }); reg("done", "e", "attended");
    give("a", { nps: 10 }); give("b", { nps: 9 }); give("e", { nps: 3 });
    expect(feedbackSummary(db, "done").nps).toBe(33); // (2 - 1) / 3
  });
  it("has null (not 0 or NaN) averages when nobody answered, and a null rate when nobody could", () => {
    expect(feedbackSummary(db, "done")).toMatchObject({ n: 0, avgRating: null, nps: null, responseRate: 0 });
    expect(feedbackSummary(db, "soon")).toMatchObject({ n: 0, eligible: 0, responseRate: null });
  });
  it("lists comments newest first, naming the author only when the answer is not anonymous", () => {
    give("a", { went_well: "Loved the demo", improve: "", anonymous: false }, new Date(NOW.getTime() - 60_000));
    give("b", { went_well: "", improve: "Too loud", anonymous: true });
    const c = feedbackSummary(db, "done").comments;
    expect(c.map((x) => x.text)).toEqual(["Too loud", "Loved the demo"]);
    expect(c[0]).toMatchObject({ kind: "improve", author: null });
    expect(c[1].author).toEqual({ mn: "Нэр a", en: "Name a" });
    expect(JSON.stringify(feedbackSummary(db, "done"))).not.toContain('"profile_id":"b"');
  });
});

describe("feedback requests", () => {
  it("go out one hour after the event, once, to attended and going people only", () => {
    const early = new Date(new Date(at(-4)).getTime() + 30 * 60_000);
    expect(enqueueFeedbackRequests(db, early)).toBe(0);
    expect(enqueueFeedbackRequests(db, NOW)).toBe(2);
    expect(enqueueFeedbackRequests(db, NOW)).toBe(0);
    expect(queued(db, "feedback_request").map((n) => n.profile_id).sort()).toEqual(["a", "b"]);
    expect(inboxFor(db, "a", {}).some((i) => i.kind === "feedback_request")).toBe(true);
  });
  it("skips people who already answered and stops after the window", () => {
    give("a");
    expect(enqueueFeedbackRequests(db, NOW)).toBe(1);
    expect(enqueueFeedbackRequests(db, new Date(NOW.getTime() + 15 * 86_400_000))).toBe(0);
  });
  it("is part of the cron beat", () => {
    expect(tick(db, NOW).reminders).toBeGreaterThanOrEqual(0);
    expect(db.notifications.filter((n) => n.template === "feedback_request")).toHaveLength(2);
  });
});
