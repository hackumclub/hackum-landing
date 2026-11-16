import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/events/questions";
import { responsesToCsv } from "@/lib/forms/csv";

/** Minimal RFC 4180 reader so the tests check what a spreadsheet would see. */
function parse(csv: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) { if (c === '"') { if (csv[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; continue; }
    if (c === '"') quoted = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\r") { /* skip */ } else if (c === "\n") { row.push(cell); out.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}
const Q = (id: string, over: Partial<Question> = {}): Question => ({ id, type: "short", label: { mn: `Асуулт ${id}`, en: `Question ${id}` }, required: false, ...over });
const row = (answers: Record<string, string | string[] | boolean>, over = {}) => ({ profile_id: "p1", name: { mn: "Болд", en: "Bold" }, submitted_at: "2026-11-16T04:00:00.000Z", status: "going", answers, ...over });

describe("responsesToCsv", () => {
  it("starts with a BOM, uses CRLF and localised headers (Name, Submitted, Status, then each question)", () => {
    const csv = responsesToCsv([Q("a")], [row({ a: "x" })], "en");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(parse(csv.slice(1))[0]).toEqual(["Name", "Submitted", "Status", "Question a"]);
    expect(parse(responsesToCsv([Q("a")], [], "mn").slice(1))[0][3]).toBe("Асуулт a");
  });
  it.each(["=1+1", "+SUM(A1)", "-2+3", "@cmd", "\tTabbed", "\rCarriage"])("neutralises a formula-looking cell %j with a leading apostrophe", (v) => {
    const cells = parse(responsesToCsv([Q("a")], [row({ a: v })], "en").slice(1))[1];
    expect(cells[3]).toBe(`'${v}`);
  });
  it("round-trips commas, quotes, newlines and Mongolian text", () => {
    const nasty = 'Сайн байна уу, "Өнөөдөр"\nҮүр, өөр мөр';
    const cells = parse(responsesToCsv([Q("a")], [row({ a: nasty }, { name: { mn: "Ө,Ү", en: "" } })], "mn").slice(1))[1];
    expect(cells[0]).toBe("Ө,Ү");
    expect(cells[3]).toBe(nasty);
  });
  it("writes option labels, joins multi answers and prints checkbox as Yes/No", () => {
    const qs = [Q("s", { type: "select", options: [{ mn: "Анхан", en: "Beginner" }, { mn: "Ахисан", en: "Advanced" }] }), Q("m", { type: "multi", options: [{ mn: "А", en: "A" }, { mn: "Б", en: "B" }] }), Q("c", { type: "checkbox" })];
    const cells = parse(responsesToCsv(qs, [row({ s: "1", m: ["0", "1"], c: true }), row({ c: false })], "en").slice(1));
    expect(cells[1].slice(3)).toEqual(["Advanced", "A; B", "Yes"]);
    expect(cells[2].slice(3)).toEqual(["", "", "No"]);
  });
  it("adds a column for answers to questions that were removed", () => {
    const parsed = parse(responsesToCsv([Q("a")], [row({ a: "1", gone: "old" })], "en").slice(1));
    expect(parsed[0].slice(3)).toEqual(["Question a", "Removed question: gone"]);
    expect(parsed[1].slice(3)).toEqual(["1", "old"]);
  });
  it("prints Submitted in Ulaanbaatar time", () => {
    expect(parse(responsesToCsv([], [row({})], "en").slice(1))[1][1]).toBe("2026-11-16 12:00");
  });
});
