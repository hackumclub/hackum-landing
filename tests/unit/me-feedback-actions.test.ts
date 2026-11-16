// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ErrorCode, Result } from "@/lib/result";
import type { Ctx, Db } from "@/lib/mockdb/types";
import { feedbackCopy, feedbackMessage } from "@/components/me/feedback/copy";
import { addEvent, addProfile, at, ctx as mkCtx, emptyDb } from "./helpers/fixture";

let db: Db;
let actor: string | null = "me";
let forced: ErrorCode | null = null;
vi.mock("@/lib/server/session", () => ({
  act: async <T,>(rule: (c: Ctx) => Result<T>) => (forced ? { ok: false, error: forced } : rule(mkCtx(db, actor))),
}));
const { submitFeedbackAction } = await import("@/lib/me/feedback-actions");

const CODES: ErrorCode[] = ["unauthenticated", "forbidden", "not_found", "invalid", "conflict", "full", "closed", "rate_limited", "ineligible", "server"];
const good = { eventId: "e", rating: 4, nps: 9, went_well: "Great pace", improve: "", anonymous: true };
const seat = (profile: string, status: Db["registrations"][number]["status"]) =>
  db.registrations.push({ id: `r_${profile}`, event_id: "e", profile_id: profile, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-400), cancelled_at: null });

beforeEach(() => {
  db = emptyDb(); actor = "me"; forced = null;
  addProfile(db, { id: "me", status: "member" });
  addEvent(db, { id: "e", status: "completed", starts_at: at(-26), ends_at: at(-24) });
  seat("me", "attended");
});

describe("messages", () => {
  it("has a sentence for every error code in both languages and never the code", () => {
    for (const lang of ["mn", "en"] as const) {
      expect(Object.keys(feedbackCopy[lang].errors).sort()).toEqual([...CODES].sort());
      for (const code of CODES) {
        const m = feedbackMessage(code, lang);
        expect(m.trim().length, `${lang}/${code}`).toBeGreaterThan(8);
        expect(m).not.toBe(code);
        expect(m).not.toMatch(/^[a-z_]+$/);
      }
    }
  });
  it("uses the wording the spec asks for", () => {
    expect(feedbackMessage("forbidden", "en")).toBe("Only people who came can answer");
    expect(feedbackMessage("closed", "en")).toBe("This survey is closed");
  });
});

describe("submitFeedbackAction", () => {
  it("stores the answer for the signed-in person and returns its id", async () => {
    const r = await submitFeedbackAction("en", good);
    expect(r.ok).toBe(true);
    expect(db.event_feedback).toHaveLength(1);
    expect(db.event_feedback[0]).toMatchObject({ profile_id: "me", event_id: "e", rating: 4, nps: 9, anonymous: true });
  });

  it("a second submit edits the same row instead of adding one", async () => {
    await submitFeedbackAction("en", good);
    await submitFeedbackAction("en", { ...good, rating: 2, anonymous: false });
    expect(db.event_feedback).toHaveLength(1);
    expect(db.event_feedback[0]).toMatchObject({ rating: 2, anonymous: false });
  });

  it("signed out: unauthenticated, nothing stored", async () => {
    actor = null;
    expect(await submitFeedbackAction("en", good)).toMatchObject({ ok: false, error: "unauthenticated" });
    expect(db.event_feedback).toEqual([]);
  });

  it("a no-show or someone who never registered gets the 'only people who came' sentence", async () => {
    db.registrations[0].status = "no_show";
    expect(await submitFeedbackAction("en", good)).toEqual({ ok: false, error: "forbidden", message: "Only people who came can answer" });
    db.registrations.length = 0;
    expect(await submitFeedbackAction("mn", good)).toMatchObject({ ok: false, error: "forbidden", message: feedbackMessage("forbidden", "mn") });
  });

  it("after the 14 days: closed with its sentence", async () => {
    db.events[0].ends_at = at(-24 * 15); db.events[0].starts_at = at(-24 * 15 - 2);
    expect(await submitFeedbackAction("en", good)).toEqual({ ok: false, error: "closed", message: "This survey is closed" });
  });

  it("unknown event: not_found", async () => {
    expect(await submitFeedbackAction("en", { ...good, eventId: "nope" })).toMatchObject({ ok: false, error: "not_found" });
  });

  it.each([
    ["rating 0", { rating: 0 }], ["rating 6", { rating: 6 }], ["rating 3.5", { rating: 3.5 }], ["rating as text", { rating: "4" }],
    ["nps -1", { nps: -1 }], ["nps 11", { nps: 11 }], ["nps null", { nps: null }],
    ["1001 characters", { went_well: "x".repeat(1001) }], ["improve not text", { improve: 5 }],
    ["anonymous as text", { anonymous: "yes" }], ["no event", { eventId: "" }], ["extra shape", { eventId: { $ne: 1 } }],
  ])("zod rejects %s before the rule runs", async (_n, over) => {
    expect(await submitFeedbackAction("en", { ...good, ...over })).toMatchObject({ ok: false, error: "invalid" });
    expect(db.event_feedback).toEqual([]);
  });

  it("rejects non-object input and an unknown language falls back to Mongolian", async () => {
    expect(await submitFeedbackAction("en", null)).toMatchObject({ ok: false, error: "invalid" });
    expect(await submitFeedbackAction("en", "x")).toMatchObject({ ok: false, error: "invalid" });
    expect(await submitFeedbackAction("xx" as never, { ...good, rating: 0 })).toMatchObject({ message: feedbackMessage("invalid", "mn") });
  });

  it.each(CODES)("maps a rule failure with %s to a sentence", async (code) => {
    forced = code;
    const r = await submitFeedbackAction("en", good);
    expect(r).toMatchObject({ ok: false, error: code });
    if (!r.ok) { expect(r.message).toBe(feedbackMessage(code, "en")); expect(r.message).not.toBe(code); }
  });
});
