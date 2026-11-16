// @vitest-environment node
import { describe, expect, it } from "vitest";
import { activeCount, emptyListState, mergeIntoQuery, parseListState, serializeListState, type ListSpec } from "@/lib/admin/list-state";

const SPEC = {
  search: true,
  dates: true,
  multi: { status: ["applied", "going", "waitlisted"], semester: (v: string) => /^\d{4}-(autumn|spring)$/.test(v) },
  single: { filter: ["applications", "needs_en"], tab: ["directory", "applications"] },
} as const satisfies ListSpec;

const parse = (qs: string) => parseListState(new URLSearchParams(qs), SPEC);

describe("parseListState", () => {
  it("reads search, chip groups, single values, a date range and the page", () => {
    const s = parse("q=bat&status=applied,going&filter=needs_en&from=2026-09-01&to=2026-12-31&page=3");
    expect(s.q).toBe("bat");
    expect(s.multi.status).toEqual(["applied", "going"]);
    expect(s.single.filter).toBe("needs_en");
    expect(s.from).toBe("2026-09-01");
    expect(s.to).toBe("2026-12-31");
    expect(s.page).toBe(3);
  });

  it("ignores bad values instead of failing", () => {
    const s = parse("status=applied,hacked,,going,applied&filter=nope&tab=&from=2026-02-30&to=2026-12-31&page=-4&semester=2026-autumn,x");
    expect(s.multi.status).toEqual(["applied", "going"]); // unknown dropped, duplicates removed
    expect(s.single.filter).toBeNull();
    expect(s.single.tab).toBeNull();
    expect(s.from).toBeNull(); // an impossible date drops the whole range
    expect(s.to).toBeNull();
    expect(s.page).toBe(1);
    expect(s.multi.semester).toEqual(["2026-autumn"]); // predicate validation
  });

  it("drops a reversed range, caps the search length and the page number", () => {
    expect(parse("from=2026-12-31&to=2026-09-01").from).toBeNull();
    expect(parse(`q=${"a".repeat(500)}`).q.length).toBe(80);
    expect(parse("page=99999999").page).toBe(10_000);
    expect(parse("page=2.5").page).toBe(1);
    expect(parse("page=abc").page).toBe(1);
  });

  it("takes the first of a repeated parameter and accepts Next's searchParams object", () => {
    expect(parseListState({ status: ["going", "applied"], q: ["x", "y"] }, SPEC).multi.status).toEqual(["going"]);
    expect(parseListState({ q: ["x", "y"] }, SPEC).q).toBe("x");
    expect(parseListState({}, SPEC)).toEqual(emptyListState(SPEC));
  });

  it("returns canonical order for array-validated groups", () => {
    expect(parse("status=going,applied").multi.status).toEqual(["applied", "going"]);
  });
});

describe("serializeListState", () => {
  it("round-trips and omits empty values", () => {
    const qs = "q=bat&status=applied%2Cgoing&filter=needs_en&from=2026-09-01&to=2026-12-31&page=2";
    expect(serializeListState(parse(qs), SPEC).toString()).toBe(qs);
    expect(serializeListState(emptyListState(SPEC), SPEC).toString()).toBe("");
  });

  it("never writes page 1 and trims the search", () => {
    const s = { ...emptyListState(SPEC), q: "  hi  ", page: 1 };
    expect(serializeListState(s, SPEC).toString()).toBe("q=hi");
  });
});

describe("mergeIntoQuery", () => {
  it("keeps parameters the list does not own (tab, state) and replaces its own", () => {
    const owned = { ...SPEC, single: { filter: SPEC.single.filter } }; // `tab` belongs to someone else here
    const state = { ...emptyListState(owned), multi: { status: ["going"], semester: [] } };
    expect(mergeIntoQuery("tab=applications&status=applied&state=slow", state, owned)).toBe("tab=applications&state=slow&status=going");
  });
  it("returns an empty string when nothing is left", () => {
    expect(mergeIntoQuery("status=applied", emptyListState(SPEC), SPEC)).toBe("");
  });
});

describe("activeCount", () => {
  it("counts the search, each chip, each single value and the date range once", () => {
    expect(activeCount(emptyListState(SPEC))).toBe(0);
    expect(activeCount(parse("q=a&status=applied,going&filter=needs_en&from=2026-09-01&to=2026-12-31&page=2"))).toBe(1 + 2 + 1 + 1);
  });
  it("ignores keys listed in `ignore` (a tab is not a filter)", () => {
    expect(activeCount(parse("tab=applications"), ["tab"])).toBe(0);
    expect(activeCount(parse("tab=applications"))).toBe(1);
  });
});
