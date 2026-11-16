// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/mockdb/seed";
import { eventReport, periodReport } from "@/lib/mockdb/reports";
import { analytics } from "@/lib/mockdb/analytics";
import { semesterOf, semesterRange } from "@/lib/semester";
import {
  docTitle, eventKpis, fileSafe, npsOrNa, pctOrNa, periodKpis, ratingBars, ratingOrNa, ratioOf, uniqueAttendees,
} from "@/lib/admin/report-view";
import { copy } from "@/i18n/areas/admin-reports";
import { emptyDb, addProfile, addEvent } from "./helpers/fixture";

const NOW = new Date("2026-11-16T04:00:00Z");
const na = "n/a";

describe("formatters never print NaN, Infinity or undefined", () => {
  it("percent: rounds, clamps nothing, and turns missing values into n/a", () => {
    expect(pctOrNa(0.616, na)).toBe("62%");
    expect(pctOrNa(0, na)).toBe("0%");
    expect(pctOrNa(1, na)).toBe("100%");
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(pctOrNa(bad, na), String(bad)).toBe(na);
  });
  it("rating: one decimal, n/a when there are no answers", () => {
    expect(ratingOrNa(4.25, na)).toBe("4.3");
    expect(ratingOrNa(4, na)).toBe("4.0");
    expect(ratingOrNa(null, na)).toBe(na);
    expect(ratingOrNa(Number.NaN, na)).toBe(na);
  });
  it("NPS: signed, real minus sign, zero unsigned, n/a for null", () => {
    expect(npsOrNa(42, na)).toBe("+42");
    expect(npsOrNa(-8, na)).toBe("−8");
    expect(npsOrNa(0, na)).toBe("0");
    expect(npsOrNa(-0, na)).toBe("0");
    expect(npsOrNa(null, na)).toBe(na);
    expect(npsOrNa(Number.NaN, na)).toBe(na);
  });
  it("ratioOf never divides by zero", () => {
    expect(ratioOf(1, 4)).toBe(0.25);
    expect(ratioOf(3, 0)).toBeNull();
    expect(ratioOf(Number.NaN, 5)).toBeNull();
  });
});

describe("file and document names", () => {
  it("builds a document title that is also the PDF file name", () => {
    expect(docTitle(copy.en.doc.title, "Pitch Night · Autumn")).toBe("Hackum report — Pitch Night · Autumn");
    expect(docTitle(copy.mn.doc.title, "2026-09-01 – 2026-12-31")).toBe("Hackum тайлан — 2026-09-01 – 2026-12-31");
  });
  it("makes safe file names: keeps letters (Mongolian too), drops separators and dots, never empty", () => {
    expect(fileSafe("Pitch Night · Autumn")).toBe("pitch-night-autumn");
    expect(fileSafe("Алгоритмын өдөр / 2026")).toBe("алгоритмын-өдөр-2026");
    expect(fileSafe("../../etc/passwd")).toBe("etc-passwd");
    expect(fileSafe("   ")).toBe("report");
    expect(fileSafe("x".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("KPIs from the seed", () => {
  const db = buildSeed(NOW);
  const ev = db.events.find((e) => e.slug === "pitch-night-autumn")!;
  it("event report KPIs are all strings, none NaN, and agree with the report", () => {
    const r = eventReport(db, ev.id)!;
    const k = eventKpis(r, copy.en);
    expect(k.map((x) => x.key)).toEqual(["registered", "going", "attended", "showRate", "rating", "nps", "responseRate"]);
    for (const x of k) { expect(x.value, x.key).not.toMatch(/NaN|Infinity|undefined/); expect(x.value.length).toBeGreaterThan(0); }
    expect(k[0].value).toBe(String(r.funnel.registered));
    expect(k[2].value).toBe(String(r.funnel.attended));
    expect(k[3].value).toBe(pctOrNa(r.showRate, na));
  });
  it("an event with no data reads n/a, never NaN", () => {
    const empty = emptyDb();
    addProfile(empty, { id: "p" });
    addEvent(empty, { id: "e", status: "completed" });
    const k = eventKpis(eventReport(empty, "e")!, copy.en);
    expect(k.map((x) => x.value)).toEqual(["0", "0", "0", na, na, na, na]);
  });
  it("period KPIs: unique attendees count people once, rates are n/a for an empty range", () => {
    const range = semesterRange(semesterOf(NOW));
    const pr = periodReport(db, range, NOW);
    const people = uniqueAttendees(db, range);
    expect(people).toBeGreaterThan(0);
    expect(people).toBeLessThanOrEqual(pr.analytics.funnel.attended);
    const k = periodKpis(pr, db, copy.en);
    expect(k.map((x) => x.key)).toEqual(["events", "attendees", "showRate", "newMembers", "rating", "nps"]);
    for (const x of k) expect(x.value, x.key).not.toMatch(/NaN|Infinity|undefined/);
    const none = { from: "2001-03-01", to: "2001-03-01" };
    const kn = periodKpis(periodReport(db, none, NOW), db, copy.en);
    expect(kn.map((x) => x.value)).toEqual(["0", "0", na, "0", na, na]);
    expect(uniqueAttendees(db, none)).toBe(0);
    expect(analytics(db, none).funnel.attended).toBe(0);
  });
});

describe("rating bars", () => {
  it("lists 5 stars first and keeps zero buckets", () => {
    const bars = ratingBars([1, 0, 2, 5, 9], (n) => `${n}★`);
    expect(bars.map((b) => b.label)).toEqual(["5★", "4★", "3★", "2★", "1★"]);
    expect(bars.map((b) => b.values[0])).toEqual([9, 5, 2, 0, 1]);
  });
});
