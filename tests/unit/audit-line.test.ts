// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildChangeLine } from "@/lib/members/audit-line";

const fmt = (key: string, v: unknown) => (key === "status" ? String(v)[0]!.toUpperCase() + String(v).slice(1) : v == null ? "—" : String(v));
const label = (k: string) => ({ role: "role", capacity: "Seats", venue_name: "Venue", ics_sequence: "Calendar version" })[k] ?? k;
const opts = { fmt, label, more: (n: number) => `+${n} more` };

describe("buildChangeLine", () => {
  it("writes a status change as 'Draft → Published' with no label", () => {
    expect(buildChangeLine({ status: ["draft", "published"] }, opts)).toBe("Draft → Published");
  });
  it("labels other changes: 'role: organizer → admin'", () => {
    expect(buildChangeLine({ role: ["organizer", "admin"] }, opts)).toBe("role: organizer → admin");
  });
  it("reads a change from nothing as a value that was set", () => {
    expect(buildChangeLine({ role: [null, "organizer"] }, opts)).toBe("role: organizer");
  });
  it("shows plain values as 'label: value'", () => {
    expect(buildChangeLine({ slug: "devhack" }, opts)).toBe("slug: devhack");
  });
  it("joins at most two changes and counts the rest", () => {
    expect(buildChangeLine({ capacity: [50, 60], venue_name: ["A", "B"], ics_sequence: [0, 1] }, opts)).toBe("Seats: 50 → 60 · Venue: A → B · +1 more");
  });
  it("returns null when there is nothing to say", () => {
    expect(buildChangeLine({}, opts)).toBeNull();
  });
  it("treats an array that is not a before/after pair as a plain value", () => {
    expect(buildChangeLine({ tags: ["a", "b", "c"] }, opts)).toBe("tags: a,b,c");
  });
});
