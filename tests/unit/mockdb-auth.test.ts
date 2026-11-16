// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { addPasskey, requestEmailCode, signInWithPasskey, verifyEmailCode } from "@/lib/mockdb/auth";
import { addProfile, ctx, emptyDb, NOW, queued } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addProfile(db, { id: "ann", email: "ann@example.com" });
});
const later = (min: number) => new Date(NOW.getTime() + min * 60_000);
const request = (email: string, now = NOW) => requestEmailCode(ctx(db, null, now), email);
const verify = (email: string, code: string, now = NOW, create?: Parameters<typeof verifyEmailCode>[3]) => verifyEmailCode(ctx(db, null, now), email, code, create);
const issue = (email = "ann@example.com", now = NOW) => { const r = request(email, now); if (!r.ok) throw new Error(r.error); return r.data.code; };
const wrong = (code: string) => (code === "000000" ? "111111" : "000000");

describe("email one-time code", () => {
  it("signs in an existing profile with the right code, case-insensitively on the email", () => {
    const code = issue("Ann@Example.com");
    expect(code).toMatch(/^\d{6}$/);
    expect(verify("ann@example.com", code)).toEqual({ ok: true, data: { profile_id: "ann", created: false } });
  });
  it("is single use", () => {
    const code = issue();
    expect(verify("ann@example.com", code).ok).toBe(true);
    expect(verify("ann@example.com", code)).toEqual({ ok: false, error: "invalid" });
  });
  it("expires after 10 minutes", () => {
    const code = issue();
    expect(verify("ann@example.com", code, later(11))).toEqual({ ok: false, error: "invalid" });
    expect(verify("ann@example.com", code, later(9)).ok).toBe(true);
  });
  it("locks after 5 wrong tries, even for the right code", () => {
    const code = issue();
    for (let i = 0; i < 5; i++) expect(verify("ann@example.com", wrong(code))).toEqual({ ok: false, error: "invalid" });
    expect(verify("ann@example.com", code)).toEqual({ ok: false, error: "rate_limited" });
  });
  it("allows 5 sends an hour per email and the 6th is rate limited, then recovers", () => {
    for (let i = 0; i < 5; i++) expect(request("ann@example.com", later(i)).ok).toBe(true);
    expect(request("ann@example.com", later(6))).toEqual({ ok: false, error: "rate_limited" });
    expect(request("ann@example.com", later(61)).ok).toBe(true);
    expect(request("bob@example.com", later(6)).ok).toBe(true);
  });
  it("a newer code replaces the older one", () => {
    const first = issue(); const second = issue("ann@example.com", later(1));
    expect(verify("ann@example.com", first, later(1))).toEqual({ ok: false, error: "invalid" });
    expect(verify("ann@example.com", second, later(1)).ok).toBe(true);
  });
  it("rejects malformed emails and codes without sending anything", () => {
    for (const bad of ["", "no-at", "a@b", "x".repeat(250) + "@e.com", "a b@e.com"]) expect(request(bad)).toEqual({ ok: false, error: "invalid" });
    expect(db.auth_codes).toHaveLength(0);
    issue();
    for (const bad of ["12345", "1234567", "abcdef", ""]) expect(verify("ann@example.com", bad)).toEqual({ ok: false, error: "invalid" });
  });
  it("does not create an account for an unknown email unless the sign-up form came with the code", () => {
    const code = issue("new@example.com");
    expect(verify("new@example.com", code)).toEqual({ ok: false, error: "not_found" });
    expect(db.profiles.find((p) => p.email === "new@example.com")).toBeUndefined();
    const created = verify("new@example.com", code, NOW, { name: { mn: "Бат", en: "Bat" }, locale: "mn" });
    expect(created.ok && created.data.created).toBe(true);
    const p = db.profiles.find((x) => x.email === "new@example.com")!;
    expect(p).toMatchObject({ status: "guest", visibility: "members", locale: "mn", name: { mn: "Бат", en: "Bat" } });
    expect(p.onboarded_at).not.toBeNull();
    expect(queued(db, "welcome")).toHaveLength(1);
  });
  it("gives each new account a unique handle even when two share an email local part", () => {
    for (const email of ["sam@a.com", "sam@b.com"]) verify(email, issue(email), NOW, { name: { mn: "С", en: "S" }, locale: "en" });
    const handles = db.profiles.filter((p) => p.email?.startsWith("sam@")).map((p) => p.handle);
    expect(new Set(handles).size).toBe(2);
  });
  it("never signs in a deleted profile", () => {
    db.profiles[0].deleted_at = NOW.toISOString();
    expect(verify("ann@example.com", issue())).toEqual({ ok: false, error: "not_found" });
  });
});

describe("passkeys (mock of the Clerk ceremony)", () => {
  it("needs a signed-in user to add one, trims the label and caps them at 5", () => {
    expect(addPasskey(ctx(db, null), "Laptop")).toEqual({ ok: false, error: "unauthenticated" });
    expect(addPasskey(ctx(db, "ann"), "  ")).toEqual({ ok: false, error: "invalid" });
    const r = addPasskey(ctx(db, "ann"), "  MacBook ");
    expect(r.ok && r.data.label).toBe("MacBook");
    for (let i = 0; i < 4; i++) expect(addPasskey(ctx(db, "ann"), `Key ${i}`).ok).toBe(true);
    expect(addPasskey(ctx(db, "ann"), "Sixth")).toEqual({ ok: false, error: "conflict" });
  });
  it("signs in only a profile that has a passkey", () => {
    expect(signInWithPasskey(ctx(db, null), "ann@example.com")).toEqual({ ok: false, error: "not_found" });
    addPasskey(ctx(db, "ann"), "Phone");
    expect(signInWithPasskey(ctx(db, null), "Ann@Example.com")).toEqual({ ok: true, data: { profile_id: "ann" } });
    expect(signInWithPasskey(ctx(db, null), "nobody@example.com")).toEqual({ ok: false, error: "not_found" });
  });
});
