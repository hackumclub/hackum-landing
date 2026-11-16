// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/mockdb/types";
import { createEvent, previewEventChange } from "@/lib/mockdb/events";
import { addEvent, addStaff, ctx, emptyDb, NOW } from "./helpers/fixture";
import {
  changedFields, defaultState, eventInputSchema, moveQuestion, newQuestion, nextQuestionId, slugify, stateFromEvent, toInput, validate, type FormState,
} from "@/lib/events/admin-form";

const base = (over: Partial<FormState> = {}): FormState => ({
  ...defaultState(NOW),
  slug: "hello-world", title: { mn: "Сайн уу", en: "Hello" },
  starts_at: new Date("2026-12-01T10:00:00Z"), ends_at: new Date("2026-12-01T12:00:00Z"), venue_name: "МУИС",
  ...over,
});
const opts = { takenSlugs: [] as string[] };

describe("slugify", () => {
  it("prefers the English title", () => expect(slugify({ mn: "Мэдлэгийн өдөр", en: "Knowledge Day: RAG!" })).toBe("knowledge-day-rag"));
  it("transliterates Mongolian Cyrillic when there is no English title", () => {
    expect(slugify({ mn: "Мэдлэгийн өдөр", en: "" })).toBe("medlegiin-udur");
    expect(slugify({ mn: "Хакатон Шинэ жил", en: " " })).toBe("khakaton-shine-jil");
  });
  it("caps at 60 characters without a trailing dash and strips the unsafe", () => {
    const s = slugify({ mn: "", en: `${"a".repeat(58)} b--c` });
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s).toMatch(/^[a-z0-9-]+$/);
    expect(s.endsWith("-")).toBe(false);
  });
  it("is empty when nothing usable is left", () => expect(slugify({ mn: "", en: "" })).toBe(""));
});

describe("validate (mirrors the rule's valid())", () => {
  it("accepts a complete form", () => expect(validate(base(), opts)).toEqual({}));
  it("slug format and uniqueness", () => {
    expect(validate(base({ slug: "Hi" }), opts).slug).toBe("slug_format");
    expect(validate(base({ slug: "ab" }), opts).slug).toBe("slug_format");
    expect(validate(base({ slug: "ok-slug" }), { takenSlugs: ["ok-slug"] }).slug).toBe("slug_taken");
  });
  it("needs a Mongolian title", () => expect(validate(base({ title: { mn: "  ", en: "Hello" } }), opts).title).toBe("required"));
  it("dates: both required, end after start", () => {
    expect(validate(base({ starts_at: null }), opts).starts_at).toBe("required");
    expect(validate(base({ ends_at: null }), opts).ends_at).toBe("required");
    expect(validate(base({ ends_at: new Date("2026-12-01T10:00:00Z") }), opts).ends_at).toBe("end_before_start");
  });
  it("capacity 1..5000 integer unless unlimited", () => {
    expect(validate(base({ unlimited: false, capacity: "0" }), opts).capacity).toBe("capacity_range");
    expect(validate(base({ unlimited: false, capacity: "5001" }), opts).capacity).toBe("capacity_range");
    expect(validate(base({ unlimited: false, capacity: "2.5" }), opts).capacity).toBe("capacity_range");
    expect(validate(base({ unlimited: false, capacity: "" }), opts).capacity).toBe("capacity_range");
    expect(validate(base({ unlimited: false, capacity: "60" }), opts).capacity).toBeUndefined();
    expect(validate(base({ unlimited: true, capacity: "garbage" }), opts).capacity).toBeUndefined();
  });
  it("registration window: closes before start, opens before closes", () => {
    expect(validate(base({ reg_closes_at: new Date("2026-12-02T00:00:00Z") }), opts).reg_closes_at).toBe("closes_after_start");
    expect(validate(base({ reg_opens_at: new Date("2026-11-30T00:00:00Z"), reg_closes_at: new Date("2026-11-29T00:00:00Z") }), opts).reg_opens_at).toBe("opens_after_closes");
  });
  it("application events need a decision deadline", () => {
    expect(validate(base({ reg_mode: "application" }), opts).decision_deadline).toBe("required");
    expect(validate(base({ reg_mode: "application", decision_deadline: new Date("2026-11-25T00:00:00Z") }), opts).decision_deadline).toBeUndefined();
  });
  it("team size 1 ≤ min ≤ max ≤ 10 only when teams are on", () => {
    const app = { reg_mode: "application", decision_deadline: new Date("2026-11-25T00:00:00Z") } as const;
    expect(validate(base({ ...app, team_mode: "optional", team_size_min: 3, team_size_max: 2 }), opts).team_size).toBe("team_range");
    expect(validate(base({ ...app, team_mode: "required", team_size_min: 0, team_size_max: 2 }), opts).team_size).toBe("team_range");
    expect(validate(base({ ...app, team_mode: "required", team_size_min: 1, team_size_max: 11 }), opts).team_size).toBe("team_range");
    expect(validate(base({ ...app, team_mode: "none", team_size_min: 9, team_size_max: 1 }), opts).team_size).toBeUndefined();
    expect(validate(base({ team_mode: "optional", team_size_min: 9, team_size_max: 1 }), opts).team_size).toBeUndefined(); // RSVP events have no teams
  });
  it("online and hybrid need an https link, offline does not", () => {
    expect(validate(base({ mode: "online", online_url: "" }), opts).online_url).toBe("https_required");
    expect(validate(base({ mode: "hybrid", online_url: "http://x.com" }), opts).online_url).toBe("https_required");
    expect(validate(base({ mode: "online", online_url: "https://meet.example.com/x" }), opts).online_url).toBeUndefined();
    expect(validate(base({ mode: "offline", online_url: "" }), opts).online_url).toBeUndefined();
  });
  it("questions: label, ≥2 options for select/multi, ≤20, unique ids", () => {
    const app = { reg_mode: "application", decision_deadline: new Date("2026-11-25T00:00:00Z") } as const;
    const q = (over: Record<string, unknown> = {}) => ({ ...newQuestion(["x"], "short"), ...over });
    expect(validate(base({ ...app, questions: [q({ label: { mn: "", en: "" } })] }), opts)["q0.label"]).toBe("required");
    expect(validate(base({ ...app, questions: [q({ type: "select", options: [{ mn: "A", en: "" }] })] }), opts)["q0.options"]).toBe("options_min_2");
    expect(validate(base({ ...app, questions: [q({ type: "multi", options: [{ mn: "A", en: "" }, { mn: " ", en: "" }] })] }), opts)["q0.options"]).toBe("options_min_2");
    const many = Array.from({ length: 21 }, (_, i) => q({ id: `q${i + 1}`, label: { mn: "x", en: "" } }));
    expect(validate(base({ ...app, questions: many }), opts).questions).toBe("too_many");
    expect(validate(base({ questions: [q({ label: { mn: "", en: "" } })] }), opts)["q0.label"]).toBeUndefined(); // RSVP events keep no questions
  });
});

describe("question builder helpers", () => {
  it("nextQuestionId is unique, valid and stable", () => {
    expect(nextQuestionId([])).toBe("q1");
    expect(nextQuestionId(["q1", "q2"])).toBe("q3");
    expect(nextQuestionId(["q2"])).toBe("q1");
    expect(nextQuestionId(["q1", "q3"])).toBe("q2");
    expect(nextQuestionId(["q1"])).toMatch(/^[a-z0-9_]{1,32}$/);
  });
  it("newQuestion seeds two options for select and multi", () => {
    expect(newQuestion([], "select").options).toHaveLength(2);
    expect(newQuestion([], "multi").options).toHaveLength(2);
    expect(newQuestion([], "short").options).toBeUndefined();
  });
  it("moveQuestion swaps neighbours and ignores the edges", () => {
    const qs = ["a", "b", "c"].map((id) => ({ ...newQuestion([], "short"), id }));
    expect(moveQuestion(qs, 0, 1).map((q) => q.id)).toEqual(["b", "a", "c"]);
    expect(moveQuestion(qs, 2, -1).map((q) => q.id)).toEqual(["a", "c", "b"]);
    expect(moveQuestion(qs, 0, -1)).toBe(qs);
    expect(moveQuestion(qs, 2, 1)).toBe(qs);
  });
});

describe("state ↔ EventInput", () => {
  it("a form the client accepts is a form the rule accepts, and the staged-edit preview agrees", () => {
    const db = emptyDb();
    addStaff(db, "org", "organizer");
    const s = base({ unlimited: false, capacity: "40", mode: "hybrid", online_url: "https://meet.example.com/x", reg_mode: "application", decision_deadline: new Date("2026-11-25T00:00:00Z"), team_mode: "optional", team_size_min: 2, team_size_max: 4, questions: [newQuestion([], "short")].map((q) => ({ ...q, label: { mn: "Асуулт", en: "" } })) });
    expect(validate(s, opts)).toEqual({});
    const input = toInput(s, null);
    expect(eventInputSchema.safeParse(input).success).toBe(true);
    const made = createEvent(ctx(db, "org"), input);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const row = db.events.find((e) => e.id === made.data.id)!;
    const back = stateFromEvent(row);
    expect(toInput(back, row)).toEqual(input);
    expect(previewEventChange(ctx(db, "org"), row.id, toInput(back, row))).toEqual({ ok: true, data: { changed: [], willNotify: 0, nonNumRegistrants: 0 } });
  });
  it("offline events drop the online link; online events drop the address; unlimited means null capacity", () => {
    const off = toInput(base({ mode: "offline", online_url: "https://stale.example.com", venue_name: "МУИС", venue_address: "x" }), null);
    expect(off.online_url).toBeNull();
    const on = toInput(base({ mode: "online", online_url: "https://meet.example.com/x", venue_name: "stale", venue_address: "stale" }), null);
    expect(on).toMatchObject({ venue_name: null, venue_address: null, online_url: "https://meet.example.com/x" });
    expect(toInput(base({ unlimited: true, capacity: "12" }), null).capacity).toBeNull();
  });
  it("keeps fields the form does not edit (poster, themes, external link)", () => {
    const db = emptyDb();
    const e = addEvent(db, { id: "e1", poster_path: "/p.jpg", themes: ["AI"], external_url: "https://x.example" });
    const input = toInput(stateFromEvent(e), e);
    expect(input).toMatchObject({ poster_path: "/p.jpg", themes: ["AI"], external_url: "https://x.example" });
  });
  it("trims text and treats an empty cover path as none", () => {
    const i = toInput(base({ title: { mn: "  Сайн  ", en: " Hi " }, cover_path: "  " }), null);
    expect(i.title).toEqual({ mn: "Сайн", en: "Hi" });
    expect(i.cover_path).toBeNull();
  });
});

describe("eventInputSchema (server-side guard against hand-crafted payloads)", () => {
  const good = () => toInput(base(), null);
  it("accepts the good payload", () => expect(eventInputSchema.safeParse(good()).success).toBe(true));
  it.each([
    ["unknown kind", { kind: "party" }],
    ["unknown audience", { audience: "everyone" }],
    ["non-string title", { title: { mn: 5, en: "" } }],
    ["bad date string", { starts_at: "tomorrow" }],
    ["huge description", { description: { mn: "x".repeat(20001), en: "" } }],
    ["fractional capacity", { capacity: 1.5 }],
  ])("rejects %s", (_n, over) => expect(eventInputSchema.safeParse({ ...good(), ...over }).success).toBe(false));
});

describe("changedFields (before/after in the staged-edit dialog)", () => {
  it("lists only what changed, flags the fields that notify people", () => {
    const db = emptyDb();
    const e: EventRow = addEvent(db, { id: "e1", venue_name: "МУИС 305" });
    const input = { ...toInput(stateFromEvent(e), e), venue_name: "МУИС 101", capacity: 50, title: { mn: "Шинэ нэр", en: e.title.en } };
    const diff = changedFields(e, input);
    expect(diff.map((d) => d.key).sort()).toEqual(["capacity", "title", "venue_name"]);
    expect(diff.find((d) => d.key === "venue_name")).toMatchObject({ notifies: true });
    expect(diff.find((d) => d.key === "capacity")).toMatchObject({ notifies: false });
  });
  it("is empty when nothing changed", () => {
    const db = emptyDb();
    const e = addEvent(db, { id: "e1" });
    expect(changedFields(e, toInput(stateFromEvent(e), e))).toEqual([]);
  });
});
