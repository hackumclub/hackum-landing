// @vitest-environment node
import { describe, expect, it } from "vitest";
import * as dedupe from "@/lib/notify/dedupe";

describe("dedupe keys", () => {
  it("reminder24 embeds starts_at epoch seconds so a reschedule yields a new key", () => {
    expect(dedupe.reminder24("e1", "p1", new Date("2026-11-25T10:00:00Z"))).toBe("reminder24:e1:p1:1795600800");
    expect(dedupe.reminder24("e1", "p1", new Date("2026-11-25T11:00:00Z"))).not.toBe(dedupe.reminder24("e1", "p1", new Date("2026-11-25T10:00:00Z")));
  });
  it("reminder24 ignores sub-second noise", () => {
    expect(dedupe.reminder24("e1", "p1", new Date("2026-11-25T10:00:00.900Z"))).toBe("reminder24:e1:p1:1795600800");
  });
  it("builds the other keys", () => {
    expect(dedupe.eventUpdated("e1", "p1", 4)).toBe("event_updated:e1:p1:4");
    expect(dedupe.rsvpConfirmed("e1", "p1")).toBe("rsvp_confirmed:e1:p1");
    expect(dedupe.decision("e1", "p1", "accepted")).toBe("decision:e1:p1:accepted");
    expect(dedupe.welcome("p1")).toBe("welcome:p1");
  });
});
