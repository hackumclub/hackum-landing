import { describe, expect, it } from "vitest";
import { generateInviteCode, INVITE_ALPHABET, normalizeInviteCode } from "@/lib/teams/invite-code";

const SHAPE = /^HK-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

describe("generateInviteCode", () => {
  it("is HK- plus three groups of four from an alphabet without I, O, 0 and 1", () => {
    for (let i = 0; i < 50; i++) expect(generateInviteCode()).toMatch(SHAPE);
    expect(INVITE_ALPHABET).toHaveLength(32);
    expect(INVITE_ALPHABET).not.toMatch(/[IO01]/);
  });
  it("does not repeat (60 random bits): 2000 codes are all distinct", () => {
    expect(new Set(Array.from({ length: 2000 }, generateInviteCode)).size).toBe(2000);
  });
  it("uses every symbol of the alphabet (no stuck or biased position)", () => {
    const seen = new Set(Array.from({ length: 400 }, generateInviteCode).join("").replace(/HK|-/g, ""));
    expect(seen.size).toBe(32);
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["hk-abcd-efgh-jkmn", "HK-ABCD-EFGH-JKMN"],
    [" HK ABCD EFGH JKMN ", "HK-ABCD-EFGH-JKMN"],
    ["hkabcdefghjkmn", "HK-ABCD-EFGH-JKMN"],
    ["HK-ABCD-EFGH-JKMN\n", "HK-ABCD-EFGH-JKMN"],
    ["hk-7k2p", "HK-7K2P"], // the short demo codes keep working
    ["hk7k2p", "HK-7K2P"],
    ["  nonsense ", "NONSENSE"],
    ["", ""],
  ])("%j → %j", (raw, expected) => {
    expect(normalizeInviteCode(raw)).toBe(expected);
  });
  it("never throws on odd input", () => {
    expect(() => normalizeInviteCode("\u0000\ud800 ✓ ".repeat(50))).not.toThrow();
  });
});
