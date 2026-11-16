// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { updateProfile } from "@/lib/mockdb/profile";
import { addProfile, ctx, emptyDb } from "./helpers/fixture";

let db: Db;
beforeEach(() => { db = emptyDb(); addProfile(db, { id: "me" }); addProfile(db, { id: "other" }); });
const base = { name: { mn: " Болд ", en: " Bold " }, grad_year: 2028 as number | null, links: { github: "https://github.com/bold" } as Record<string, string>, visibility: "members" as const, locale: "en" as const };

describe("updateProfile", () => {
  it("saves trimmed basics on the actor's own profile only", () => {
    expect(updateProfile(ctx(db, "me"), base).ok).toBe(true);
    expect(db.profiles.find((p) => p.id === "me")).toMatchObject({ name: { mn: "Болд", en: "Bold" }, grad_year: 2028, visibility: "members", locale: "en", links: { github: "https://github.com/bold" } });
    expect(db.profiles.find((p) => p.id === "other")!.name.mn).toBe("Нэр other");
    expect(updateProfile(ctx(db, null), base)).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("allows clearing the graduation year", () => {
    expect(updateProfile(ctx(db, "me"), { ...base, grad_year: null }).ok).toBe(true);
    expect(db.profiles[0].grad_year).toBeNull();
  });
  it.each([
    ["blank Mongolian name", { name: { mn: "  ", en: "x" } }],
    ["81-char name", { name: { mn: "x".repeat(81), en: "" } }],
    ["graduation year 1999", { grad_year: 1999 }],
    ["graduation year 2041", { grad_year: 2041 }],
    ["fractional year", { grad_year: 2028.5 }],
    ["unknown visibility", { visibility: "friends" }],
    ["unknown language", { locale: "de" }],
    ["http link", { links: { website: "http://example.com" } }],
    ["javascript: link", { links: { website: "javascript:alert(1)" } }],
    ["bad link key", { links: { "Web Site": "https://example.com" } }],
    ["seven links", { links: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`site${String.fromCharCode(97 + i)}`, "https://example.com"])) }],
    ["a 201-char link", { links: { website: `https://example.com/${"a".repeat(190)}` } }],
  ])("rejects %s", (_n, over) => {
    expect(updateProfile(ctx(db, "me"), { ...base, ...over } as never)).toEqual({ ok: false, error: "invalid" });
  });
});
