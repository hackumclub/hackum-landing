// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { subscribe } from "@/lib/mockdb/ext-subscribe";
import { ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
beforeEach(() => { db = emptyDb(); });
const run = (input: Parameters<typeof subscribe>[1]) => subscribe(ctx(db, null), input);

describe("subscribe", () => {
  it("stores a new sign-up for an anonymous visitor", () => {
    expect(run({ name: "Bat", email: "bat@example.com", lang: "mn" })).toEqual({ ok: true, data: { created: true } });
    expect(db.subscribers).toEqual([{ email: "bat@example.com", name: "Bat", lang: "mn", source: "join_page", created_at: NOW.toISOString() }]);
  });

  it("normalises: trims and collapses the name, lowercases the email", () => {
    run({ name: "  Bat   Erdene ", email: "  Bat.Erdene@Example.COM ", lang: "en" });
    expect(db.subscribers[0]).toMatchObject({ name: "Bat Erdene", email: "bat.erdene@example.com", lang: "en" });
  });

  it("treats a duplicate email (any letter case) as success without adding a row or touching the original", () => {
    run({ name: "Bat", email: "bat@example.com", lang: "mn" });
    const again = run({ name: "Someone else", email: "BAT@Example.com", lang: "en" });
    expect(again).toEqual({ ok: true, data: { created: false } });
    expect(db.subscribers).toHaveLength(1);
    expect(db.subscribers[0]).toMatchObject({ name: "Bat", lang: "mn" });
  });

  it("keeps an allow-listed source and falls back to join_page for anything else", () => {
    run({ name: "A", email: "a@example.com", lang: "mn", source: "event_page" });
    run({ name: "B", email: "b@example.com", lang: "mn", source: "<script>" });
    expect(db.subscribers.map((s) => s.source)).toEqual(["event_page", "join_page"]);
  });

  it.each([
    ["empty name", { name: "   ", email: "a@example.com" }],
    ["name over 80 chars", { name: "x".repeat(81), email: "a@example.com" }],
    ["control character in name", { name: "Ba\u0000t", email: "a@example.com" }],
    ["email without domain", { name: "A", email: "a@" }],
    ["email with whitespace inside", { name: "A", email: "a b@example.com" }],
    ["email over 254 chars", { name: "A", email: `${"a".repeat(60)}@${"b".repeat(200)}.com` }],
  ])("rejects %s with invalid and stores nothing", (_label, input) => {
    expect(run({ ...input, lang: "mn" })).toEqual({ ok: false, error: "invalid" });
    expect(db.subscribers).toHaveLength(0);
  });

  it("does not let an invalid retry probe: duplicates are only detected after validation", () => {
    run({ name: "Bat", email: "bat@example.com", lang: "mn" });
    expect(run({ name: "", email: "bat@example.com", lang: "mn" })).toEqual({ ok: false, error: "invalid" });
  });
});
