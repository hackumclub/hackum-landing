import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadPrograms, searchPrograms, trackOf, type NumProgram } from "@/lib/num/programs";
import { isMajorTrack } from "@/lib/num/schools";
import { PROGRAMS_FIXTURE } from "./helpers/num-programs-fixture";

const JSON_PATH = path.resolve(__dirname, "../../src/data/num-programs.json");
const idx = (rows: NumProgram[]) => rows.map((r) => r.index);

describe("trackOf", () => {
  const cases: [string, string, string][] = [
    ["Программ хангамж", "Software engineering", "software"],
    ["Компьютерын ухаан", "Computer science", "cs"],
    ["Компьютерийн ухаан", "", "cs"],
    ["Мэдээллийн систем", "Information systems", "is"],
    ["Мэдээллийн технологи", "Information technology", "it"],
    ["Гэрэл зураг", "Photography", "other"],
    ["Багш, мэдээлэл зүйн боловсрол", "Teacher training - Information technology", "other"],
  ];
  it.each(cases)("%s / %s -> %s", (mn, en, track) => {
    expect(trackOf({ name: { mn, en } })).toBe(track);
  });
  it("is case- and whitespace-insensitive and matches either language", () => {
    expect(trackOf({ name: { mn: "x", en: "  SOFTWARE   Engineering " } })).toBe("software");
    expect(trackOf({ name: { mn: "КОМПЬЮТЕРЫН УХААН", en: "" } })).toBe("cs");
  });
});

describe("searchPrograms (injected fixture)", () => {
  const s = (q: string, lang: "mn" | "en", opts?: Parameters<typeof searchPrograms>[2]) => searchPrograms(q, lang, opts, PROGRAMS_FIXTURE);

  it("defaults to a limit of 8 and lists browsable rows for an empty query", () => {
    const many: NumProgram[] = Array.from({ length: 20 }, (_, i) => ({ ...PROGRAMS_FIXTURE[0], index: `D ${i}`, name: { mn: `Хөтөлбөр ${i}`, en: `Program ${i}` } }));
    expect(searchPrograms("", "en", undefined, many)).toHaveLength(8);
    expect(searchPrograms("", "en", { limit: 3 }, many)).toHaveLength(3);
  });
  it("matches Mongolian, English and index, case-insensitively", () => {
    expect(idx(s("КОМПЬЮТЕР", "mn", { level: "bachelor" }))[0]).toBe("D 061301");
    expect(idx(s("software", "en", { level: "bachelor" }))).toContain("D 061302");
    expect(idx(s("D 061302", "en"))).toContain("D 061302");
    expect(idx(s("d061302", "en"))).toContain("D 061302");
  });
  it("is diacritic-insensitive", () => {
    const rows: NumProgram[] = [{ ...PROGRAMS_FIXTURE[0], index: "X 1", name: { mn: "Café", en: "Café studies" } }];
    expect(searchPrograms("cafe", "en", undefined, rows)).toHaveLength(1);
    expect(searchPrograms("CAFÉ", "en", undefined, rows)).toHaveLength(1);
  });
  it("ranks prefix matches before substring matches", () => {
    // "comp": Computer science (prefix) must come before Computational... no: both prefix; use "science" vs "data"
    const r = s("data", "en", { level: "bachelor" });
    expect(r[0].index).toBe("D 052001"); // "Computational data analysis" contains data, only one match
    const r2 = s("info", "en", { level: "bachelor" });
    expect(r2[0].index).toBe("D 061303"); // "Information systems" prefix before "Teacher training - Information technology"
    expect(idx(r2)).toContain("D 011403");
  });
  it("filters by level", () => {
    expect(new Set(s("computer", "en", { level: "master" }).map((r) => r.level))).toEqual(new Set(["master"]));
    expect(s("computer", "en").length).toBe(3);
  });
  it("returns nothing for a query that matches nothing", () => {
    expect(s("zzzzzz", "mn")).toEqual([]);
  });
});

describe("real bundled data", () => {
  let programs: NumProgram[];
  beforeAll(async () => { programs = await loadPrograms(); });

  it("lists D 061302 first for 'программ' at bachelor level (default source after loadPrograms)", () => {
    const r = searchPrograms("программ", "mn", { level: "bachelor" });
    expect(r[0].index).toBe("D 061302");
    expect(r.every((p) => p.level === "bachelor")).toBe(true);
  });
  it("software/en/bachelor only returns bachelor rows", () => {
    const r = searchPrograms("software", "en", { level: "bachelor" }, programs);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.level === "bachelor")).toBe(true);
  });
  it("loadPrograms is memoised", async () => {
    expect(await loadPrograms()).toBe(programs);
  });
  it("JSON has the documented shape, stays under 120 KB and carries the licence", () => {
    const raw = readFileSync(JSON_PATH, "utf8");
    expect(statSync(JSON_PATH).size).toBeLessThan(120 * 1024);
    const doc = JSON.parse(raw) as { source: string; license: string; fetched_at: string; programs: NumProgram[] };
    expect(doc.license).toMatch(/CC BY-SA/);
    expect(doc.source).toMatch(/data\.num\.edu\.mn/);
    expect(Number.isNaN(Date.parse(doc.fetched_at))).toBe(false);
    expect(doc.programs.length).toBeGreaterThan(100);
  });
  it("every row has a non-empty mn+en name, index, valid level and a track equal to trackOf", () => {
    for (const p of programs) {
      expect(p.name.mn.trim()).not.toBe("");
      expect(p.name.en.trim()).not.toBe("");
      expect(p.index).toBe(p.index.trim());
      expect(["bachelor", "master", "doctor"]).toContain(p.level);
      expect(isMajorTrack(p.track)).toBe(true);
      expect(p.track).toBe(trackOf(p));
    }
  });
  it("has no duplicate (index, name, level) rows and is sorted by level", () => {
    const keys = programs.map((p) => `${p.index}|${p.name.mn}|${p.level}`);
    expect(new Set(keys).size).toBe(keys.length);
    const order = { bachelor: 0, master: 1, doctor: 2 } as const;
    for (let i = 1; i < programs.length; i++) expect(order[programs[i].level]).toBeGreaterThanOrEqual(order[programs[i - 1].level]);
  });
});
