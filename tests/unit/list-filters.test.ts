// @vitest-environment node
import { describe, expect, it } from "vitest";
import { facetCounts, filterApplications, filterComms, filterEvents, filterMembers, filterRegistrations, semesterKey, ubDayOf, type MemberFilterRow } from "@/lib/admin/list-filters";
import { emptyListState, parseListState, type ListSpec } from "@/lib/admin/list-state";

const SPEC = {
  search: true, dates: true,
  multi: { status: [], school: ["num", "other"], track: ["software", "cs", "is", "it", "other", "unknown"], semester: () => true, season: () => true, team: () => true, template: () => true, kind: () => true, scope: ["num", "all"], team_: [] },
  single: { filter: ["applications", "missing_cover", "needs_en"] },
} as const satisfies ListSpec;
const st = (qs: string) => parseListState(new URLSearchParams(qs), { ...SPEC, multi: { ...SPEC.multi, status: ["draft", "published", "applied", "going", "member", "guest", "alumni", "queued", "failed", "cancelled"] } });

const mem = (id: string, over: Partial<MemberFilterRow> = {}): MemberFilterRow => ({
  name: { mn: `Нэр ${id}`, en: `Name ${id}` }, handle: id, status: "member", school: "МУИС", schoolId: "num", track: "software", seasons: [2026], teams: [],
  createdAt: "2026-09-10T04:00:00Z", lastSeenAt: "2026-11-01T04:00:00Z", activeSemesters: ["2026-autumn"], ...over,
});

describe("filterMembers", () => {
  const rows = [
    mem("a"),
    mem("b", { status: "guest", schoolId: "must", school: "ШУТИС", track: null, activeSemesters: [] }),
    mem("c", { schoolId: null, school: null, track: "cs", createdAt: "2025-02-01T04:00:00Z", lastSeenAt: null, activeSemesters: ["2025-spring"], seasons: [2025], teams: ["Design"] }),
  ];
  const ids = (qs: string, by: "joined" | "seen" = "joined") => filterMembers(rows, st(qs), by).map((m) => m.handle);

  it("filters NUM versus other school (a missing school counts as other)", () => {
    expect(ids("school=num")).toEqual(["a"]);
    expect(ids("school=other")).toEqual(["b", "c"]);
    expect(ids("school=num,other")).toEqual(["a", "b", "c"]);
  });
  it("filters by major track, with 'unknown' meaning not set", () => {
    expect(ids("track=cs")).toEqual(["c"]);
    expect(ids("track=unknown")).toEqual(["b"]);
    expect(ids("track=unknown,cs")).toEqual(["b", "c"]);
  });
  it("filters by active semester, season, team and status together", () => {
    expect(ids("semester=2025-spring")).toEqual(["c"]);
    expect(ids("season=2025")).toEqual(["c"]);
    expect(ids("team=Design")).toEqual(["c"]);
    expect(ids("status=member&school=other")).toEqual(["c"]);
  });
  it("applies the date range to joined or last seen", () => {
    expect(ids("from=2026-09-01&to=2026-12-31")).toEqual(["a", "b"]);
    expect(ids("from=2026-10-01&to=2026-11-30", "seen")).toEqual(["a", "b"]);
    expect(ids("from=2026-09-01&to=2026-12-31", "seen")).toEqual(["a", "b"]);
    expect(ids("from=2025-01-01&to=2025-12-31", "seen")).toEqual([]); // never seen is outside any range
  });
  it("searches name, school and handle, case-insensitively", () => {
    expect(ids("q=name%20B")).toEqual(["b"]);
    expect(ids("q=%D0%A8%D0%A3%D0%A2%D0%98%D0%A1")).toEqual(["b"]);
  });
  it("facet counts equal the rows you get by picking that chip", () => {
    const state = st("school=num");
    const counts = facetCounts(rows, state, "track", ["software", "cs", "unknown"], (r, s) => filterMembers(r, s));
    expect(counts).toEqual({ software: 1, cs: 0, unknown: 0 });
    expect(filterMembers(rows, st("school=num&track=software")).length).toBe(counts.software);
  });
});

describe("filterApplications", () => {
  const apps = [
    { name: { mn: "А", en: "A" }, handle: "a", school: "МУИС", schoolId: "num", track: "cs", createdAt: "2026-11-01T04:00:00Z" },
    { name: { mn: "Б", en: "B" }, handle: "b", school: "ШУТИС", schoolId: "must", track: null, createdAt: "2026-11-02T04:00:00Z" },
  ];
  it("separates NUM applicants from the rest", () => {
    expect(filterApplications(apps, st("school=num")).map((a) => a.handle)).toEqual(["a"]);
    expect(filterApplications(apps, st("school=other&track=unknown")).map((a) => a.handle)).toEqual(["b"]);
  });
});

describe("filterRegistrations", () => {
  const r = (id: string, status: string, over: Record<string, unknown> = {}) => ({ id, name: { mn: id, en: id }, school: "МУИС", status, teamId: null as string | null, createdAt: "2026-11-05T04:00:00Z", answers: {} as Record<string, unknown>, ...over });
  const rows = [r("a", "applied"), r("b", "going", { teamId: "t1" }), r("c", "cancelled"), r("d", "applied", { answers: { lang: "1" }, createdAt: "2026-08-01T04:00:00Z" })];
  const spec: ListSpec = { search: true, dates: true, multi: { status: ["applied", "going", "cancelled"], team: ["team", "solo"], a_lang: ["0", "1"] } };
  const ids = (qs: string) => filterRegistrations(rows, parseListState(new URLSearchParams(qs), spec)).map((x) => x.id);
  it("hides cancelled people unless that chip is chosen", () => {
    expect(ids("")).toEqual(["a", "b", "d"]);
    expect(ids("status=cancelled")).toEqual(["c"]);
    expect(ids("status=applied")).toEqual(["a", "d"]);
  });
  it("filters team, registered date and answers", () => {
    expect(ids("team=team")).toEqual(["b"]);
    expect(ids("team=solo")).toEqual(["a", "d"]);
    expect(ids("from=2026-09-01&to=2026-12-31")).toEqual(["a", "b"]);
    expect(ids("a_lang=1")).toEqual(["d"]);
  });
});

describe("filterComms", () => {
  const rows = [
    { template: "welcome", group: "sent", recipient: "Bat", scheduledAt: "2026-11-01T04:00:00Z", sentAt: "2026-11-01T04:05:00Z" },
    { template: "reminder_24h", group: "failed", recipient: "Sara", scheduledAt: "2026-11-10T04:00:00Z", sentAt: null },
  ];
  it("combines status chips, template chips and the scheduled/sent date", () => {
    const f = (qs: string) => filterComms(rows, st(qs)).map((r) => r.recipient);
    expect(f("status=failed")).toEqual(["Sara"]);
    expect(f("template=welcome")).toEqual(["Bat"]);
    expect(f("from=2026-11-05&to=2026-11-30")).toEqual(["Sara"]);
    expect(f("q=sa")).toEqual(["Sara"]);
  });
});

describe("filterEvents", () => {
  const rows = [
    { title: { mn: "А", en: "Alpha" }, slug: "alpha", stored: "published", kind: "meetup", scope: "num", applied: 3, cover: null, noEnTitle: false },
    { title: { mn: "Б", en: "" }, slug: "beta", stored: "draft", kind: "hackathon", scope: "all", applied: 0, cover: "x.jpg", noEnTitle: true },
  ];
  const f = (qs: string) => filterEvents(rows, st(qs)).map((r) => r.slug);
  it("honours the dashboard presets exactly like the dashboard counts them", () => {
    expect(f("filter=applications")).toEqual(["alpha"]);
    expect(f("filter=missing_cover")).toEqual(["alpha"]);
    expect(f("filter=needs_en")).toEqual(["beta"]);
  });
  it("combines status, kind and scope chips with the search", () => {
    expect(f("status=draft")).toEqual(["beta"]);
    expect(f("kind=meetup&scope=num")).toEqual(["alpha"]);
    expect(f("scope=all")).toEqual(["beta"]);
    expect(f("q=alp")).toEqual(["alpha"]);
  });
});

describe("date helpers", () => {
  it("reads the Ulaanbaatar day and semester of an instant", () => {
    expect(ubDayOf("2026-12-31T16:30:00Z")).toBe("2027-01-01");
    expect(semesterKey(new Date("2026-11-16T04:00:00Z"))).toBe("2026-autumn");
    expect(semesterKey(new Date("2027-03-01T04:00:00Z"))).toBe("2026-spring");
  });
  it("starts from an empty state", () => {
    expect(filterEvents([], emptyListState(SPEC))).toEqual([]);
  });
});
