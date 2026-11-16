// @vitest-environment node
import { describe, expect, it } from "vitest";
import { answersSchema, parseAnswers, questionsSchema, type Question } from "@/lib/events/questions";

const L = (mn: string, en = "") => ({ mn, en });
const qs: Question[] = [
  { id: "why", type: "short", label: L("Яагаад?", "Why?"), required: true },
  { id: "bio", type: "long", label: L("Тухай"), required: false },
  { id: "size", type: "select", label: L("Размер"), required: true, options: [L("S"), L("M"), L("L")] },
  { id: "diet", type: "multi", label: L("Хоол"), required: false, options: [L("Veg"), L("Halal"), L("None")] },
  { id: "site", type: "url", label: L("Вэб"), required: false },
  { id: "rules", type: "checkbox", label: L("Дүрэм"), required: true },
];
const valid = { why: "Сурах", size: "1", rules: true };

describe("questionsSchema", () => {
  it("accepts a valid list, with empty en labels", () => {
    expect(questionsSchema.safeParse(qs).success).toBe(true);
    expect(questionsSchema.safeParse([]).success).toBe(true);
  });
  it("rejects duplicate ids", () => {
    const r = questionsSchema.safeParse([qs[0], { ...qs[1], id: "why" }]);
    expect(r.success).toBe(false);
  });
  it("rejects bad ids", () => {
    for (const id of ["Why", "a-b", "", "x".repeat(33), "я"]) {
      expect(questionsSchema.safeParse([{ ...qs[0], id }]).success, id).toBe(false);
    }
    expect(questionsSchema.safeParse([{ ...qs[0], id: "x".repeat(32) }]).success).toBe(true);
  });
  it("caps at 20 questions", () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...qs[0], id: `q${i}` }));
    expect(questionsSchema.safeParse(many(20)).success).toBe(true);
    expect(questionsSchema.safeParse(many(21)).success).toBe(false);
  });
  it("requires >=2 options on select/multi", () => {
    expect(questionsSchema.safeParse([{ ...qs[2], options: [L("S")] }]).success).toBe(false);
    expect(questionsSchema.safeParse([{ ...qs[3], options: undefined }]).success).toBe(false);
  });
  it("requires label.mn", () => {
    expect(questionsSchema.safeParse([{ ...qs[0], label: L("  ", "Why") }]).success).toBe(false);
  });
});

describe("answersSchema / parseAnswers", () => {
  it("accepts valid answers", () => {
    const r = parseAnswers(qs, { ...valid, bio: "x", diet: ["0", "2"], site: "https://hackum.mn" });
    expect(r).toEqual({ ok: true, data: { why: "Сурах", bio: "x", size: "1", diet: ["0", "2"], site: "https://hackum.mn", rules: true } });
  });
  it("flags a missing required short answer at its id", () => {
    const r = parseAnswers(qs, { size: "0", rules: true });
    expect(r).toEqual({ ok: false, errors: { why: "required" } });
    const s = answersSchema(qs).safeParse({ size: "0", rules: true });
    expect(s.success).toBe(false);
    if (!s.success) expect(s.error.issues.some((i) => i.path[0] === "why")).toBe(true);
  });
  it("treats blank strings, empty multi and unchecked required checkbox as missing", () => {
    const r = parseAnswers(qs, { why: "   ", size: "", rules: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toEqual({ why: "required", size: "required", rules: "required" });
    const multiReq = [{ ...qs[3], required: true }];
    expect(parseAnswers(multiReq, { diet: [] })).toEqual({ ok: false, errors: { diet: "required" } });
  });
  it("omits optional questions left empty", () => {
    const r = parseAnswers(qs, { ...valid, bio: "", site: "", diet: [] });
    expect(r).toEqual({ ok: true, data: valid });
  });
  it("rejects out-of-range or non-numeric select indexes", () => {
    for (const bad of ["3", "-1", "1.5", "x", "01"]) {
      expect(parseAnswers(qs, { ...valid, size: bad }), bad).toEqual({ ok: false, errors: { size: "bad_option" } });
    }
  });
  it("rejects multi values outside the option range or non-arrays", () => {
    expect(parseAnswers(qs, { ...valid, diet: ["0", "5"] })).toEqual({ ok: false, errors: { diet: "bad_option" } });
    expect(parseAnswers(qs, { ...valid, diet: "0" })).toEqual({ ok: false, errors: { diet: "bad_option" } });
  });
  it("enforces length limits", () => {
    expect(parseAnswers(qs, { ...valid, why: "a".repeat(200) }).ok).toBe(true);
    expect(parseAnswers(qs, { ...valid, why: "a".repeat(201) })).toEqual({ ok: false, errors: { why: "too_long" } });
    expect(parseAnswers(qs, { ...valid, bio: "a".repeat(2000) }).ok).toBe(true);
    expect(parseAnswers(qs, { ...valid, bio: "a".repeat(2001) })).toEqual({ ok: false, errors: { bio: "too_long" } });
  });
  it("accepts only http(s) urls", () => {
    expect(parseAnswers(qs, { ...valid, site: "http://a.mn/x" }).ok).toBe(true);
    for (const bad of ["javascript:alert(1)", "ftp://a.mn", "not a url", "//a.mn"]) {
      expect(parseAnswers(qs, { ...valid, site: bad }), bad).toEqual({ ok: false, errors: { site: "bad_url" } });
    }
  });
  it("strips unknown keys", () => {
    const r = parseAnswers(qs, { ...valid, evil: "x", __proto__: { a: 1 } });
    expect(r).toEqual({ ok: true, data: valid });
  });
  it("rejects wrong types as bad input without throwing", () => {
    expect(parseAnswers(qs, { ...valid, why: 5 }).ok).toBe(false);
    expect(parseAnswers(qs, null).ok).toBe(false);
    expect(parseAnswers(qs, "x").ok).toBe(false);
  });
  it("allows an optional unchecked checkbox", () => {
    const opt = [{ ...qs[5], required: false }];
    expect(parseAnswers(opt, { rules: false })).toEqual({ ok: true, data: { rules: false } });
    expect(parseAnswers(opt, {})).toEqual({ ok: true, data: {} });
  });
});
