// @vitest-environment node
import { describe, expect, it } from "vitest";
import { auditGroup, diffPairs, entityKind, formatDiffValue, humanizeCode, notifGroup, paginate, relativeTime, seasonWindow, validateSeason, withQuery } from "@/lib/members/format";

const NOW = new Date("2026-11-16T04:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

describe("relativeTime", () => {
  it("uses the coarsest sensible unit", () => {
    expect(relativeTime(ago(20_000), NOW, "en")).toBe("just now");
    expect(relativeTime(ago(5 * MIN), NOW, "en")).toBe("5 minutes ago");
    expect(relativeTime(ago(3 * HOUR), NOW, "en")).toBe("3 hours ago");
    expect(relativeTime(ago(DAY), NOW, "en")).toBe("yesterday");
    expect(relativeTime(ago(10 * DAY), NOW, "en")).toBe("10 days ago");
    expect(relativeTime(ago(70 * DAY), NOW, "en")).toBe("2 months ago");
  });
  it("handles the future and Mongolian without throwing", () => {
    expect(relativeTime(new Date(NOW.getTime() + 2 * HOUR), NOW, "en")).toBe("in 2 hours");
    expect(relativeTime(ago(3 * HOUR), NOW, "mn").length).toBeGreaterThan(2);
  });
});

describe("seasonWindow", () => {
  const s = (o: string | null, c: string | null) => ({ application_opens_at: o, application_closes_at: c });
  it("is open between the two instants, scheduled before, closed after", () => {
    expect(seasonWindow(s("2026-11-01T00:00:00Z", "2026-12-01T00:00:00Z"), NOW)).toBe("open");
    expect(seasonWindow(s("2026-12-01T00:00:00Z", "2026-12-20T00:00:00Z"), NOW)).toBe("scheduled");
    expect(seasonWindow(s("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z"), NOW)).toBe("closed");
  });
  it("is none unless both ends are set", () => {
    expect(seasonWindow(s(null, null), NOW)).toBe("none");
    expect(seasonWindow(s("2026-11-01T00:00:00Z", null), NOW)).toBe("none");
  });
});

describe("humanizeCode", () => {
  it("turns snake_case codes into a sentence", () => {
    expect(humanizeCode("smtp_timeout")).toBe("Smtp timeout");
    expect(humanizeCode("x")).toBe("X");
  });
});

describe("audit helpers", () => {
  it("groups actions by prefix", () => {
    expect(auditGroup("event.update")).toBe("events");
    expect(auditGroup("registration.decide")).toBe("registrations");
    expect(auditGroup("decisions.send")).toBe("registrations");
    expect(auditGroup("membership.approve")).toBe("members");
    expect(auditGroup("profile.merge")).toBe("members");
    expect(auditGroup("staff.role")).toBe("staff");
    expect(auditGroup("season.upsert")).toBe("staff");
    expect(auditGroup("notification.retry")).toBe("email");
    expect(auditGroup("weird.thing")).toBe("other");
  });
  it("normalizes singular and table-style entity names", () => {
    expect(entityKind("events")).toBe("event");
    expect(entityKind("event")).toBe("event");
    expect(entityKind("event_registrations")).toBe("registration");
    expect(entityKind("membership_applications")).toBe("application");
    expect(entityKind("staff_role")).toBe("staff_role");
    expect(entityKind("mystery")).toBe("other");
  });
  it("reads [before, after] pairs and plain values from the diff", () => {
    expect(diffPairs({ status: ["draft", "published"], role: "admin", cap: [null, 60] })).toEqual([
      { key: "status", before: "draft", after: "published", changed: true },
      { key: "role", before: undefined, after: "admin", changed: false },
      { key: "cap", before: null, after: 60, changed: true },
    ]);
  });
  it("treats an array that is not a 2-tuple as a plain value", () => {
    expect(diffPairs({ ids: [1, 2, 3] })).toEqual([{ key: "ids", before: undefined, after: [1, 2, 3], changed: false }]);
  });
  it("formats values for reading", () => {
    const yes = { yes: "Yes", no: "No", empty: "—" };
    expect(formatDiffValue(null, "en", yes)).toBe("—");
    expect(formatDiffValue(undefined, "en", yes)).toBe("—");
    expect(formatDiffValue(true, "en", yes)).toBe("Yes");
    expect(formatDiffValue(60, "en", yes)).toBe("60");
    expect(formatDiffValue("2026-12-01T10:00:00.000Z", "en", yes)).toContain("Dec");
    expect(formatDiffValue("plain", "en", yes)).toBe("plain");
    expect(formatDiffValue(["a", "b"], "en", yes)).toBe("a, b");
    expect(formatDiffValue({ a: 1 }, "en", yes)).toBe('{"a":1}');
  });
});

describe("notifGroup", () => {
  it("counts sending as queued", () => {
    expect(notifGroup("sending")).toBe("queued");
    expect(notifGroup("sent")).toBe("sent");
  });
});

describe("paginate", () => {
  it("slices a page and clamps out-of-range pages", () => {
    expect(paginate(120, 2, 50)).toEqual({ page: 2, pages: 3, from: 50, to: 100 });
    expect(paginate(120, 9, 50)).toEqual({ page: 3, pages: 3, from: 100, to: 120 });
    expect(paginate(120, -4, 50)).toEqual({ page: 1, pages: 3, from: 0, to: 50 });
    expect(paginate(0, 1, 50)).toEqual({ page: 1, pages: 1, from: 0, to: 0 });
  });
});

describe("validateSeason", () => {
  const ok = { year: "2028", labelMn: "2028 оны улирал", opens: new Date("2028-01-01T00:00:00Z"), closes: new Date("2028-02-01T00:00:00Z") };
  it("accepts a valid new season and a season with no window", () => {
    expect(validateSeason(ok, [2026, 2027], false)).toEqual({});
    expect(validateSeason({ ...ok, opens: null, closes: null }, [], false)).toEqual({});
  });
  it("rejects years outside 2000-2100 and non-integers", () => {
    expect(validateSeason({ ...ok, year: "1999" }, [], false).year).toBe("year");
    expect(validateSeason({ ...ok, year: "2101" }, [], false).year).toBe("year");
    expect(validateSeason({ ...ok, year: "20.5" }, [], false).year).toBe("year");
    expect(validateSeason({ ...ok, year: "" }, [], false).year).toBe("year");
  });
  it("rejects a year that already exists when creating, but not when editing", () => {
    expect(validateSeason(ok, [2028], false).year).toBe("yearTaken");
    expect(validateSeason(ok, [2028], true)).toEqual({});
  });
  it("requires a Mongolian name", () => {
    expect(validateSeason({ ...ok, labelMn: "   " }, [], false).label).toBe("label");
  });
  it("requires both window ends or neither, and opens before closes", () => {
    expect(validateSeason({ ...ok, closes: null }, [], false).window).toBe("windowBoth");
    expect(validateSeason({ ...ok, opens: null }, [], false).window).toBe("windowBoth");
    expect(validateSeason({ ...ok, opens: ok.closes, closes: ok.opens }, [], false).window).toBe("windowOrder");
    expect(validateSeason({ ...ok, closes: ok.opens }, [], false).window).toBe("windowOrder");
  });
});

describe("withQuery", () => {
  it("appends only non-empty params, joins arrays with commas, and encodes values", () => {
    expect(withQuery("/mn/admin/audit", { group: ["events", "staff"], actor: "p_1", range: null, page: 1 })).toBe("/mn/admin/audit?group=events%2Cstaff&actor=p_1&page=1");
    expect(withQuery("/x", { a: "", b: [], c: undefined })).toBe("/x");
    expect(withQuery("/x", { q: "a b&c" })).toBe("/x?q=a+b%26c");
  });
});
