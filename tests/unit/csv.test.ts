// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/events/questions";
import { BOM, csvCell, registrationsCsv, toCsv, type CsvRegistration } from "@/lib/events/csv";

const labels = { name: "Нэр", school: "Сургууль", status: "Төлөв", team: "Баг", applied: "Бүртгүүлсэн", yes: "Тийм", no: "Үгүй" };
const enLabels = { ...labels, name: "Name", school: "School", status: "Status", team: "Team", applied: "Applied" };

const questions: Question[] = [
  { id: "skills", type: "short", label: { mn: "Ур чадвар", en: "Skills" }, required: true },
  { id: "level", type: "select", label: { mn: "Түвшин", en: "Level" }, required: true, options: [{ mn: "Анхан", en: "Beginner" }, { mn: "Ахисан", en: "Advanced" }] },
  { id: "tracks", type: "multi", label: { mn: "Чиглэл", en: "Tracks" }, required: false, options: [{ mn: "AI", en: "AI" }, { mn: "Web", en: "Web" }, { mn: "Mobile", en: "" }] },
  { id: "coc", type: "checkbox", label: { mn: "Дүрэм зөвшөөрөх", en: "Accept rules" }, required: true },
];

const row = (over: Partial<CsvRegistration> = {}): CsvRegistration => ({
  name: "Бат-Эрдэнэ", school: "МУИС", status: "Ирнэ", team: "Нохойнууд", createdAt: "2026-11-16T04:00:00.000Z", answers: {}, ...over,
});

describe("csvCell", () => {
  it("leaves plain text alone", () => expect(csvCell("МУИС")).toBe("МУИС"));
  it.each([
    ["a,b", '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ["line1\nline2", '"line1\nline2"'],
    ["line1\r\nline2", '"line1\r\nline2"'],
  ])("quotes and escapes %j", (input, out) => expect(csvCell(input)).toBe(out));
  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tx", "\rx"])("neutralises spreadsheet formulas: %j", (v) => {
    expect(csvCell(v).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
  });
  it("prefixes and still quotes when the formula also contains a comma", () => expect(csvCell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"'));
  it("does not touch = in the middle of text", () => expect(csvCell("a=b")).toBe("a=b"));
});

describe("toCsv", () => {
  it("starts with a UTF-8 BOM so Excel reads Cyrillic", () => expect(toCsv([["a"]]).startsWith(BOM)).toBe(true));
  it("uses CRLF between records and no trailing newline surprises", () => expect(toCsv([["a", "b"], ["c", "d"]])).toBe(`${BOM}a,b\r\nc,d\r\n`));
});

describe("registrationsCsv", () => {
  it("header: fixed columns then one column per question, labelled in the active language", () => {
    const mn = registrationsCsv({ questions, rows: [], lang: "mn", labels });
    expect(mn.slice(1).split("\r\n")[0]).toBe("Нэр,Сургууль,Төлөв,Баг,Бүртгүүлсэн,Ур чадвар,Түвшин,Чиглэл,Дүрэм зөвшөөрөх");
    const en = registrationsCsv({ questions, rows: [], lang: "en", labels: enLabels });
    expect(en.slice(1).split("\r\n")[0]).toBe("Name,School,Status,Team,Applied,Skills,Level,Tracks,Accept rules");
  });

  it("falls back to Mongolian for a missing English label", () => {
    const qs: Question[] = [{ id: "x", type: "short", label: { mn: "Асуулт", en: "" }, required: false }];
    expect(registrationsCsv({ questions: qs, rows: [], lang: "en", labels: enLabels })).toContain(",Асуулт\r\n");
  });

  it("writes answers: select by option label, multi joined with '; ', checkbox as yes/no, applied time in Ulaanbaatar", () => {
    const csv = registrationsCsv({
      questions, lang: "en", labels: enLabels,
      rows: [row({ answers: { skills: "Go, Rust", level: "1", tracks: ["0", "2"], coc: true } })],
    });
    const [, line] = csv.slice(1).split("\r\n");
    expect(line).toBe('Бат-Эрдэнэ,МУИС,Ирнэ,Нохойнууд,2026-11-16 12:00,"Go, Rust",Advanced,AI; Mobile,Тийм');
  });

  it("empty answers are empty cells, an unknown option index is ignored, a solo person has an empty team", () => {
    const csv = registrationsCsv({ questions, lang: "mn", labels, rows: [row({ team: null, school: null, answers: { level: "9", tracks: [] } })] });
    expect(csv.slice(1).split("\r\n")[1]).toBe("Бат-Эрдэнэ,,Ирнэ,,2026-11-16 12:00,,,,");
  });

  it("protects every cell, including names typed by applicants", () => {
    const csv = registrationsCsv({ questions, lang: "mn", labels, rows: [row({ name: "=cmd|' /C calc'!A0", answers: { skills: "@SUM(1)" } })] });
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("'@SUM(1)");
  });
});
