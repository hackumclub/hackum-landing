// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";
import { googleCalendarUrl } from "@/lib/calendar/gcal";

const base: IcsEvent = {
  uid: "e1@hackum",
  sequence: 3,
  start: new Date("2026-12-01T18:00:00+08:00"),
  end: new Date("2026-12-01T20:00:00+08:00"),
  title: "Hackum meetup",
  description: "Intro talk",
  location: "NUM, Ulaanbaatar",
  url: "https://hackum.mn/en/events/meetup",
  method: "REQUEST",
  organizerEmail: "hello@hackum.mn",
};

const unfold = (s: string) => s.replace(/\r\n[ \t]/g, "");
const lines = (s: string) => s.split("\r\n");

describe("buildIcs", () => {
  it("uses CRLF line endings only and ends with a CRLF", () => {
    const out = buildIcs([base]);
    expect(out.endsWith("\r\n")).toBe(true);
    expect(out.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(out.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(out).toContain("VERSION:2.0");
    expect(out).toContain("PRODID:");
  });

  it("emits UID, SEQUENCE and METHOD", () => {
    const out = buildIcs([base]);
    expect(out).toContain("UID:e1@hackum\r\n");
    expect(out).toContain("SEQUENCE:3\r\n");
    expect(out).toContain("METHOD:REQUEST\r\n");
    expect(out).toContain("STATUS:CONFIRMED\r\n");
  });

  it("marks METHOD:CANCEL events STATUS:CANCELLED", () => {
    const out = buildIcs([{ ...base, method: "CANCEL" }]);
    expect(out).toContain("METHOD:CANCEL\r\n");
    expect(out).toContain("STATUS:CANCELLED\r\n");
    expect(out).not.toContain("STATUS:CONFIRMED");
  });

  it("writes DTSTART/DTEND in UTC Z form", () => {
    const out = buildIcs([base]);
    expect(out).toContain("DTSTART:20261201T100000Z\r\n");
    expect(out).toContain("DTEND:20261201T120000Z\r\n");
    expect(out).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
  });

  it("escapes commas, semicolons, backslashes and newlines in text values", () => {
    const out = unfold(buildIcs([{ ...base, title: "A, B; C\\D", description: "line1\nline2\r\nline3" }]));
    expect(out).toContain("SUMMARY:A\\, B\u005c; C\\\\D\r\n");
    expect(out).toContain("DESCRIPTION:line1\\nline2\\nline3\r\n");
    expect(out).toContain("LOCATION:NUM\\, Ulaanbaatar\r\n");
  });

  it("includes organizer, url and calendar name; supports several events", () => {
    const out = buildIcs([base, { ...base, uid: "e2@hackum" }], "Hackum, events");
    expect(out).toContain("ORGANIZER:mailto:hello@hackum.mn");
    expect(out).toContain("URL:https://hackum.mn/en/events/meetup");
    expect(out).toContain("X-WR-CALNAME:Hackum\\, events");
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(out.match(/END:VEVENT/g)).toHaveLength(2);
  });

  it("omits empty optional properties", () => {
    const out = buildIcs([{ ...base, location: "", description: "", url: "" }]);
    expect(out).not.toContain("LOCATION:");
    expect(out).not.toContain("DESCRIPTION:");
    expect(out).not.toContain("URL:");
  });

  it("never emits a line longer than 75 octets", () => {
    const out = buildIcs([{ ...base, title: "x".repeat(300), description: "я".repeat(200) + "😀".repeat(40) }]);
    for (const l of lines(out)) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(75);
  });

  it("folds 60 Cyrillic characters without splitting a code point", () => {
    const title = "Хакатон программчлалын уралдаан Хакум клубын нээлттэй өдөр".padEnd(60, "ө").slice(0, 60);
    expect(Array.from(title)).toHaveLength(60);
    const out = buildIcs([{ ...base, title }]);
    const folded = lines(out).filter((l) => Buffer.byteLength(l, "utf8") > 0);
    // the title is longer than one line, so a fold happened
    expect(out).toMatch(/\r\n /);
    // every physical line is valid UTF-8 on its own (no half code points)
    for (const l of folded) {
      const round = Buffer.from(l, "utf8").toString("utf8");
      expect(round).toBe(l);
      expect(l).not.toContain("�");
    }
    const unfolded = unfold(out);
    expect(unfolded).toContain(`SUMMARY:${title}\r\n`);
    expect(Buffer.from(unfolded, "utf8").toString()).toBe(unfolded);
    expect(unfolded).not.toContain("�");
  });

  it("does not split astral (4-byte) characters", () => {
    const title = "😀".repeat(40);
    const out = buildIcs([{ ...base, title }]);
    expect(unfold(out)).toContain(`SUMMARY:${title}\r\n`);
    for (const l of lines(out)) expect(Buffer.byteLength(l, "utf8")).toBeLessThanOrEqual(75);
  });
});

describe("googleCalendarUrl", () => {
  it("builds a TEMPLATE link with UTC dates", () => {
    const u = googleCalendarUrl(base);
    expect(u.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    expect(u).toContain("action=TEMPLATE");
    expect(u).toContain("dates=20261201T100000Z/20261201T120000Z");
    const p = new URL(u).searchParams;
    expect(p.get("text")).toBe("Hackum meetup");
    expect(p.get("details")).toBe("Intro talk");
    expect(p.get("location")).toBe("NUM, Ulaanbaatar");
  });

  it("leaves out an empty location and an empty description instead of sending `location=`", () => {
    const u = googleCalendarUrl({ ...base, location: "  ", description: "" });
    expect(u).not.toContain("location=");
    expect(u).not.toContain("details=");
    expect(u).toContain("dates=20261201T100000Z/20261201T120000Z");
  });

  it("keeps Cyrillic text intact", () => {
    const u = googleCalendarUrl({ ...base, title: "Хакатон 2026" });
    expect(new URL(u).searchParams.get("text")).toBe("Хакатон 2026");
  });
});
