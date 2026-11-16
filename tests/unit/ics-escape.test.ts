// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/calendar/ics";

// BS is one backslash character. Written as a code point so the source never contains a doubled backslash before a semicolon.
const BS = String.fromCharCode(92);
const base = { uid: "e1@hackum", sequence: 0, start: new Date("2026-12-01T10:00:00Z"), end: new Date("2026-12-01T12:00:00Z"), url: "https://hackum.example/mn/events/e1", method: "REQUEST" as const, organizerEmail: "club@example.com" };
const line = (out: string, key: string) => out.split("\r\n").find((l) => l.startsWith(key + ":"))!;

describe("ICS text escaping (RFC 5545 section 3.3.11)", () => {
  it("escapes semicolons, commas, backslashes and line breaks in every text value", () => {
    const out = buildIcs([{ ...base, title: "A;B,C" + BS + "D", description: "line1\nline2; more", location: "Room 3; floor 2, МУИС" }]);
    expect(line(out, "SUMMARY")).toBe("SUMMARY:A" + BS + ";B" + BS + ",C" + BS + BS + "D");
    expect(line(out, "DESCRIPTION")).toBe("DESCRIPTION:line1" + BS + "nline2" + BS + "; more");
    expect(line(out, "LOCATION")).toBe("LOCATION:Room 3" + BS + "; floor 2" + BS + ", МУИС");
  });
  it("never leaves a bare semicolon inside a text value", () => {
    const out = buildIcs([{ ...base, title: "x;y;z", description: "", location: "" }]);
    const value = line(out, "SUMMARY").slice("SUMMARY:".length);
    expect(value.split(BS + ";").join("")).not.toContain(";");
  });
});
