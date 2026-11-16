// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/i18n/areas/me";
import type { ErrorCode, Result } from "@/lib/result";
import type { Ctx, Db } from "@/lib/mockdb/types";
import { profileMessage, type ProfileScope } from "@/lib/me/profile-messages";
import { addProfile, at, ctx as mkCtx, emptyDb } from "./helpers/fixture";
import { png } from "./helpers/images";

let db: Db;
let actor: string | null = "me";
let forced: ErrorCode | null = null;
vi.mock("@/lib/server/session", () => ({
  act: async <T,>(rule: (c: Ctx) => Result<T>) => (forced ? { ok: false, error: forced } : rule(mkCtx(db, actor))),
}));
const actions = await import("@/lib/me/profile-actions");

const CODES: ErrorCode[] = ["unauthenticated", "forbidden", "not_found", "invalid", "conflict", "full", "closed", "rate_limited", "ineligible", "server"];
const SCOPES: ProfileScope[] = ["profile", "academic", "avatar", "subjects"];
const profile = { name: { mn: "Нэр", en: "Name" }, grad_year: 2028, links: { github: "https://github.com/x" }, visibility: "public", locale: "mn" } as const;
const academic = { school_id: "num", school_name: "", major_track: "software", program_index: null, major_label: "Программ хангамж" };
const upload = (bytes: Uint8Array, type: string, lang = "en") => {
  const f = new FormData();
  f.set("file", new File([bytes as BlobPart], "a", { type }));
  f.set("lang", lang);
  return actions.uploadAvatarAction(f);
};

beforeEach(() => {
  db = emptyDb(); actor = "me"; forced = null;
  addProfile(db, { id: "me" });
  db.seasons.push({ year: 2027, label: { mn: "2027", en: "2027" }, application_opens_at: at(-24), application_closes_at: at(24 * 30), is_current: false });
});

describe("error messages", () => {
  it("has a sentence for every error code, scope and language, and never shows the code", () => {
    for (const lang of ["mn", "en"] as const) for (const scope of SCOPES) for (const code of CODES) {
      const m = profileMessage(code, lang, scope);
      expect(m.trim().length, `${lang}/${scope}/${code}`).toBeGreaterThan(8);
      expect(m).not.toBe(code);
      expect(m).not.toMatch(/^[a-z_]+$/);
    }
    for (const lang of ["mn", "en"] as const) expect(Object.keys(copy[lang].profile.err).sort()).toEqual([...CODES].sort());
  });
});

describe("profile actions map every rule error to a message", () => {
  it.each(CODES)("when the rule fails with %s", async (code) => {
    forced = code;
    const results = [
      await actions.updateProfileAction("en", profile),
      await actions.updateAcademicAction("en", academic),
      await actions.setSemesterSubjectsAction("en", { year: 2026, term: "autumn", subjects: [], shared: false }),
      await upload(png(8, 8), "image/png"),
      await actions.removeAvatarAction("en"),
      await actions.renewMembershipAction("en"),
    ];
    for (const r of results) {
      expect(r.ok).toBe(false);
      if (!r.ok) { expect(r.error).toBe(code); expect(SCOPES.map((sc) => profileMessage(code, "en", sc))).toContain(r.message); expect(r.message).not.toBe(code); }
    }
  });
});

describe("profile actions", () => {
  it("saves a valid profile and academic record for the signed-in person only", async () => {
    expect((await actions.updateProfileAction("en", { ...profile, name: { mn: "Шинэ", en: "New" } })).ok).toBe(true);
    expect(db.profiles[0].name.en).toBe("New");
    expect((await actions.updateAcademicAction("en", { ...academic, school_id: "must", major_track: "it" })).ok).toBe(true);
    expect(db.profiles[0]).toMatchObject({ school_id: "must", major_track: "it" });
  });
  it("rejects malformed input with a scoped sentence (not a zod error, not a code)", async () => {
    const r = await actions.updateProfileAction("en", { ...profile, links: { github: "http://x" } });
    expect(r).toEqual({ ok: false, error: "invalid", message: copy.en.profile.errInvalid.profile });
    const bad = await actions.updateProfileAction("mn", { nope: true });
    expect(bad).toMatchObject({ ok: false, message: copy.mn.profile.errInvalid.profile });
    const acad = await actions.updateAcademicAction("en", { ...academic, school_id: "hogwarts" });
    expect(acad).toMatchObject({ ok: false, message: copy.en.profile.errInvalid.academic });
  });
  it("checks subjects: dupes dropped, empties dropped, 13 or a 81-char one refused", async () => {
    const ok = await actions.setSemesterSubjectsAction("en", { year: 2026, term: "autumn", subjects: ["DB", "db", " ", "AI"], shared: true });
    expect(ok).toMatchObject({ ok: true, data: { subjects: ["DB", "AI"], shared: true } });
    const many = await actions.setSemesterSubjectsAction("en", { year: 2026, term: "autumn", subjects: Array.from({ length: 13 }, (_, i) => `s${i}`), shared: false });
    expect(many).toMatchObject({ ok: false, message: copy.en.profile.errInvalid.subjects });
    const long = await actions.setSemesterSubjectsAction("en", { year: 2026, term: "autumn", subjects: ["x".repeat(81)], shared: false });
    expect(long.ok).toBe(false);
  });
  it("accepts a real image and refuses SVG, a mislabelled file and oversize uploads with an avatar message", async () => {
    expect((await upload(png(64, 64), "image/png")).ok).toBe(true);
    expect(db.profiles[0].avatar_path).toMatch(/^\/api\/avatar\/me\?v=/);
    const svg = await upload(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/png");
    expect(svg).toEqual({ ok: false, error: "invalid", message: copy.en.profile.errInvalid.avatar });
    expect((await upload(png(8, 8), "image/jpeg")).ok).toBe(false);
    expect((await upload(new Uint8Array(1_048_577), "image/png", "mn"))).toMatchObject({ ok: false, message: copy.mn.profile.errInvalid.avatar });
    const empty = new FormData();
    expect(await actions.uploadAvatarAction(empty)).toMatchObject({ ok: false, error: "invalid" });
  });
  it("removes the photo and needs a signed-in user", async () => {
    await upload(png(64, 64), "image/png");
    expect((await actions.removeAvatarAction("en")).ok).toBe(true);
    expect(db.profiles[0].avatar_path).toBeNull();
    actor = null;
    expect(await actions.removeAvatarAction("en")).toMatchObject({ ok: false, error: "unauthenticated", message: copy.en.profile.err.unauthenticated });
  });
});
