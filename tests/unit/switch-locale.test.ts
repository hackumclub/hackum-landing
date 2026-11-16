import { describe, expect, it } from "vitest";
import { switchLocale } from "@/i18n/config";

describe("switchLocale (F-09)", () => {
  it("swaps the locale segment and keeps the path", () => {
    expect(switchLocale("/en/admin/events", "mn")).toBe("/mn/admin/events");
    expect(switchLocale("/mn", "en")).toBe("/en");
  });
  it("keeps the query string and the hash, even when they contain slashes", () => {
    expect(switchLocale("/en/admin/comms?status=failed", "mn")).toBe("/mn/admin/comms?status=failed");
    expect(switchLocale("/en/me/events?tab=going#top", "mn")).toBe("/mn/me/events?tab=going#top");
    expect(switchLocale("/en?next=/en/me", "mn")).toBe("/mn?next=/en/me");
  });
  it("adds the locale to an unprefixed path", () => {
    expect(switchLocale("/events?x=1", "en")).toBe("/en/events?x=1");
    expect(switchLocale("/", "mn")).toBe("/mn/");
  });
});
