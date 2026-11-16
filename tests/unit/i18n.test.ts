// @vitest-environment node
import { describe, expect, it } from "vitest";
import { plural } from "@/i18n/plural";
import { en } from "@/i18n/en";
import { mn } from "@/i18n/mn";

describe("plural", () => {
  it("uses the singular form only for one in English", () => {
    expect(plural("en", 1, en.admin.dashboard.applied)).toBe("1 application");
    expect(plural("en", 64, en.admin.dashboard.applied)).toBe("64 applications");
    expect(plural("en", 0, en.admin.dashboard.applied)).toBe("0 applications");
  });
  it("fills {n} in Mongolian", () => {
    expect(plural("mn", 7, mn.admin.dashboard.attentionItems.pending_members)).toBe("7 гишүүнчлэлийн хүсэлт хүлээгдэж байна");
  });
});

describe("status labels", () => {
  it("are non-empty in both languages", () => {
    for (const d of [mn, en]) for (const [k, v] of Object.entries(d.status)) expect(v.trim(), k).not.toBe("");
  });
});

import { tf } from "@/i18n/config";
describe("tf (content fallback)", () => {
  it("falls back to Mongolian when the English value is empty or blank", () => {
    expect(tf({ mn: "C Battle · Өвөл", en: "" }, "en")).toBe("C Battle · Өвөл");
    expect(tf({ mn: "Хакатон", en: "  " }, "en")).toBe("Хакатон");
    expect(tf({ mn: "Хакатон", en: "Hackathon" }, "en")).toBe("Hackathon");
  });
});
