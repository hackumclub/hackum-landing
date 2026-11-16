// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addEvent, emptyDb, NOW } from "./helpers/fixture";
import { changedFields, defaultState, DIFF_KEYS, eventInputSchema, stateFromEvent, toInput, validate } from "@/lib/events/admin-form";
import { missingForPublish } from "@/lib/events/readiness";

describe("school_scope in the admin form model", () => {
  it("defaults to all schools and round-trips state ↔ input", () => {
    expect(defaultState(NOW).school_scope).toBe("all");
    const db = emptyDb();
    const e = addEvent(db, { id: "e1", school_scope: "num" });
    const s = stateFromEvent(e);
    expect(s.school_scope).toBe("num");
    expect(toInput(s, e).school_scope).toBe("num");
    expect(toInput({ ...s, school_scope: "all" }, e).school_scope).toBe("all");
  });
  it("the server guard accepts both scopes and rejects anything else", () => {
    const db = emptyDb();
    const e = addEvent(db, { id: "e1" });
    const input = toInput(stateFromEvent(e), e);
    expect(eventInputSchema.safeParse({ ...input, school_scope: "num" }).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...input, school_scope: "must" }).success).toBe(false);
  });
  it("is a diff key, so narrowing the audience shows in the staged-edit dialog (and does not notify)", () => {
    expect(DIFF_KEYS).toContain("school_scope");
    const db = emptyDb();
    const e = addEvent(db, { id: "e1" });
    const next = toInput({ ...stateFromEvent(e), school_scope: "num" }, e);
    expect(changedFields(e, next)).toEqual([{ key: "school_scope", before: "all", after: "num", notifies: false }]);
  });
});

describe("seats message (F-30)", () => {
  const base = { ...defaultState(NOW), slug: "abc-def", title: { mn: "Сайн", en: "" }, unlimited: false };
  it("tells apart text that is not a number from a number out of range", () => {
    expect(validate({ ...base, capacity: "abc" }, { takenSlugs: [] }).capacity).toBe("capacity_nan");
    expect(validate({ ...base, capacity: "0" }, { takenSlugs: [] }).capacity).toBe("capacity_range");
    expect(validate({ ...base, capacity: "" }, { takenSlugs: [] }).capacity).toBe("capacity_range");
    expect(validate({ ...base, capacity: "50" }, { takenSlugs: [] }).capacity).toBeUndefined();
  });
});

describe("missingForPublish (F-15 checklist)", () => {
  const ev = (over: Parameters<typeof addEvent>[1] extends infer T ? Partial<T> : never = {}) => {
    const db = emptyDb();
    return addEvent(db, { id: "e1", ...over });
  };
  const full = { description: { mn: "Тайлбар", en: "Description" }, title: { mn: "Гарчиг", en: "Title" }, cover_path: "/img/posters/meetup-1.jpg", venue_name: "МУИС 305" };
  it("is empty for a complete event", () => expect(missingForPublish(ev(full))).toEqual([]));
  it("lists description, venue, cover and English when all are missing", () => {
    expect(missingForPublish(ev({ description: { mn: "", en: "" }, title: { mn: "Гарчиг", en: "" }, cover_path: null, venue_name: null, mode: "offline" })))
      .toEqual(["description", "venue", "cover", "english"]);
  });
  it("online events need no venue; hybrid ones do", () => {
    expect(missingForPublish(ev({ ...full, mode: "online", venue_name: null }))).toEqual([]);
    expect(missingForPublish(ev({ ...full, mode: "hybrid", venue_name: " " }))).toEqual(["venue"]);
  });
  it("English is missing when only the Mongolian description or title was written", () => {
    expect(missingForPublish(ev({ ...full, description: { mn: "Тайлбар", en: "" } }))).toEqual(["english"]);
    expect(missingForPublish(ev({ ...full, title: { mn: "Гарчиг", en: "  " } }))).toEqual(["english"]);
  });
  it("works on the form state as well as on a stored event", () => {
    const s = { ...defaultState(NOW), title: { mn: "A", en: "A" } };
    expect(missingForPublish(s)).toEqual(["description", "venue", "cover"]);
  });
});

describe("validateQuestions (shared by the event form and the forms hub)", () => {
  it("flags a blank Mongolian label, a select with fewer than 2 filled options, and more than 20 questions", async () => {
    const { validateQuestions } = await import("@/lib/events/admin-form");
    const q = (id: string, over = {}) => ({ id, type: "short" as const, label: { mn: "A", en: "" }, required: false, ...over });
    expect(validateQuestions([q("q1")])).toEqual({});
    expect(validateQuestions([q("q1", { label: { mn: " ", en: "x" } })])).toEqual({ "q0.label": "required" });
    expect(validateQuestions([q("q1", { type: "select", options: [{ mn: "a", en: "" }, { mn: " ", en: "" }] })])).toEqual({ "q0.options": "options_min_2" });
    expect(validateQuestions(Array.from({ length: 21 }, (_, i) => q(`q${i}`)))).toEqual({ questions: "too_many" });
  });
});
