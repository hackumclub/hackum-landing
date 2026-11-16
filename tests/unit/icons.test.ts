import { describe, expect, it } from "vitest";
import { eventKindIcon, icons, statusIcon } from "@/components/ui/icons";
import { ALL_STATUSES } from "@/lib/status";

const KINDS = ["hackathon", "workshop", "meetup", "competition", "knowledge_day", "outing", "other"] as const;
const NAMES = ["event", "member", "form", "analytics", "inbox", "bell", "settings", "audit", "comms", "school", "major", "semester", "passkey", "email", "upload", "filter", "date", "search", "profile", "dashboard", "site", "logout", "check", "warning", "info", "lock"];

describe("icons", () => {
  it("exposes every semantic name the screens import", () => {
    for (const n of NAMES) expect(icons, n).toHaveProperty(n);
  });
  it("has a glyph for every event kind and every status", () => {
    for (const k of KINDS) expect(eventKindIcon(k), k).toBeTruthy();
    for (const s of ALL_STATUSES) expect(statusIcon(s), s).toBeTruthy();
  });
});
