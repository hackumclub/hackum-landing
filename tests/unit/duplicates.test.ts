// @vitest-environment node
import { describe, expect, it } from "vitest";
import { levenshtein, mergeImpact, normalizeName, suggestDuplicates } from "@/lib/members/duplicates";

const p = (id: string, mn: string, email: string | null = null, en = "") => ({ id, name: { mn, en }, email });

describe("normalizeName", () => {
  it("lowercases, trims, and collapses spaces and hyphens", () => {
    expect(normalizeName("  Бат-Эрдэнэ ")).toBe("бат эрдэнэ");
    expect(normalizeName("Бат  –  Эрдэнэ")).toBe("бат эрдэнэ");
    expect(normalizeName("   ")).toBe("");
  });
});

describe("levenshtein", () => {
  it("counts single-character edits", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("анужин", "ануужин")).toBe(1);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("suggestDuplicates", () => {
  it("scores normalized-name equality 1.0", () => {
    expect(suggestDuplicates([p("a", "Бат-Эрдэнэ"), p("b", "бат-эрдэнэ ")])).toEqual([{ a: "a", b: "b", score: 1, reason: "name" }]);
  });
  it("treats a hyphen and a space as the same separator", () => {
    expect(suggestDuplicates([p("a", "Бат-Эрдэнэ"), p("b", "Бат Эрдэнэ")])[0]?.score).toBe(1);
  });
  it("matches an equal English name when the Mongolian ones differ", () => {
    expect(suggestDuplicates([p("a", "Болдын Анужин", null, "Anujin Bold"), p("b", "Б. Ануужин", null, "anujin  bold")])[0]).toMatchObject({ score: 1, reason: "name" });
  });
  it("scores Levenshtein distance up to 2 as 0.8", () => {
    expect(suggestDuplicates([p("a", "Анужин Батболд"), p("b", "Ануужин Батболт")])).toEqual([{ a: "a", b: "b", score: 0.8, reason: "similar" }]);
  });
  it("does not match a Latin lookalike that differs by more than 2 edits", () => {
    expect(suggestDuplicates([p("a", "Батболд"), p("b", "Батbold")])).toEqual([]);
  });
  it("does not fuzzy-match short names", () => {
    expect(suggestDuplicates([p("a", "Ану"), p("b", "Ана")])).toEqual([]);
  });
  it("never pairs two empty names", () => {
    expect(suggestDuplicates([p("a", ""), p("b", "  ")])).toEqual([]);
  });
  it("scores the same non-null email 1.0, ignoring case, even when names differ", () => {
    expect(suggestDuplicates([p("a", "Нэг", "X@Example.com"), p("b", "Хоёр", " x@example.com ")])).toEqual([{ a: "a", b: "b", score: 1, reason: "email" }]);
  });
  it("ignores null emails", () => {
    expect(suggestDuplicates([p("a", "Нэг", null), p("b", "Хоёр", null)])).toEqual([]);
  });
  it("has no self-pairs and lists each pair once", () => {
    const out = suggestDuplicates([p("a", "Дорж Бат"), p("b", "дорж бат"), p("c", "Дорж  Бат")]);
    expect(out.map((x) => [x.a, x.b])).toEqual([["a", "b"], ["a", "c"], ["b", "c"]]);
    expect(out.every((x) => x.a !== x.b)).toBe(true);
  });
  it("sorts by score descending, then by input order", () => {
    const out = suggestDuplicates([p("a", "Анужин Батболд"), p("b", "Ануужин Батболт"), p("c", "Анужин Батболд"), p("d", "Бусад"), p("e", "Өөр", "z@z.mn"), p("f", "Тусдаа", "z@z.mn")]);
    expect(out.map((x) => x.score)).toEqual([1, 1, 0.8, 0.8]);
    expect(out.map((x) => `${x.a}${x.b}`)).toEqual(["ac", "ef", "ab", "bc"]);
  });
});

describe("mergeImpact", () => {
  const keep = { regEvents: ["e1", "e2"], seasons: [2025], appSeasons: [2026] };
  it("counts only what actually moves (events, seasons and applications the kept profile lacks)", () => {
    expect(mergeImpact(keep, { regEvents: ["e2", "e3", "e4"], seasons: [2025, 2026], appSeasons: [2026, 2027] })).toEqual({ registrations: 2, seasons: 1, applications: 1 });
  });
  it("is all zero when the dropped profile is empty", () => {
    expect(mergeImpact(keep, { regEvents: [], seasons: [], appSeasons: [] })).toEqual({ registrations: 0, seasons: 0, applications: 0 });
  });
});
