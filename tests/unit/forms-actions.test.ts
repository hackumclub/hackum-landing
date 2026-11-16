// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/lib/events/questions";
import type { Ctx, Db } from "@/lib/mockdb/types";
import { err, type Result } from "@/lib/result";
import { addProfile, addStaff, at, emptyDb, NOW } from "./helpers/fixture";

// The session module reads cookies and the real store; the action's own logic is what is under test here.
let db: Db;
let actor: string | null;
vi.mock("@/lib/server/session", () => ({
  requireStaffAction: async () => {
    if (!actor) return err("unauthenticated");
    const role = db.staff_roles.find((r) => r.profile_id === actor)?.role ?? null;
    return role ? { ok: true, data: { profileId: actor, staffRole: role } } : err("forbidden");
  },
  act: async <T,>(rule: (ctx: Ctx) => Result<T>) => rule({ db, actor, now: NOW }),
}));
const { updateFormAction } = await import("@/lib/forms/actions");

const q = (id: string, over: Partial<Question> = {}): Question => ({ id, type: "short", label: { mn: `Асуулт ${id}`, en: `Question ${id}` }, required: false, ...over });
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addStaff(db, "adm", "admin");
  addProfile(db, { id: "mem", status: "member" });
  db.forms = [
    { id: "membership_application", kind: "membership_application", title: { mn: "Гишүүнчлэл", en: "Membership" }, questions: [q("old")], updated_at: at(-10), updated_by: null },
    { id: "join", kind: "join", title: { mn: "Нэгдэх", en: "Join" }, questions: [q("heard")], updated_at: at(-10), updated_by: null },
  ];
  actor = "org";
});

describe("updateFormAction: who may edit", () => {
  it.each([["org", true], ["adm", true], ["mem", false], [null, false]] as const)("actor %s → ok=%s", async (who, ok) => {
    actor = who;
    const r = await updateFormAction("join", [q("a")]);
    expect(r.ok).toBe(ok);
    if (!ok) expect(db.forms[1].questions.map((x) => x.id)).toEqual(["heard"]); // nothing written
  });
  it("a member gets forbidden and a signed-out caller unauthenticated", async () => {
    actor = "mem";
    expect(await updateFormAction("join", [])).toEqual({ ok: false, error: "forbidden" });
    actor = null;
    expect(await updateFormAction("join", [])).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("an organizer's save is stamped and audited", async () => {
    const r = await updateFormAction("membership_application", [q("old"), q("new", { required: true })]);
    expect(r).toMatchObject({ ok: true });
    expect(db.forms[0]).toMatchObject({ updated_by: "org" });
    expect(db.forms[0].questions.map((x) => x.id)).toEqual(["old", "new"]);
    expect(db.audit_log.at(-1)).toMatchObject({ action: "form.update", entity_id: "membership_application" });
  });
});

describe("updateFormAction: payload mapping", () => {
  it.each([
    ["not an array", { id: "x" }],
    ["null", null],
    ["21 questions", Array.from({ length: 21 }, (_, i) => q(`q${i}`))],
    ["duplicate ids", [q("x"), q("x")]],
    ["bad id characters", [q("Bad Id!")]],
    ["a select with one option", [q("s", { type: "select", options: [{ mn: "a", en: "" }] })]],
    ["a blank Mongolian label", [q("x", { label: { mn: " ", en: "" } })]],
    ["an unknown type", [{ ...q("x"), type: "date" }]],
    ["a 10 000 character label", [q("x", { label: { mn: "a".repeat(10_000), en: "" } })]],
  ])("%s → invalid, nothing written", async (_n, payload) => {
    expect(await updateFormAction("join", payload)).toEqual({ ok: false, error: "invalid" });
    expect(db.forms[1].questions.map((x) => x.id)).toEqual(["heard"]);
  });
  it("accepts exactly 20 questions and an empty form", async () => {
    expect((await updateFormAction("join", Array.from({ length: 20 }, (_, i) => q(`q${i}`)))).ok).toBe(true);
    expect((await updateFormAction("join", [])).ok).toBe(true);
  });
  it("the form id: unknown or event forms are not_found, non-strings invalid", async () => {
    expect(await updateFormAction("event:e1", [])).toEqual({ ok: false, error: "not_found" });
    expect(await updateFormAction("nope", [])).toEqual({ ok: false, error: "not_found" });
    expect(await updateFormAction(42, [])).toEqual({ ok: false, error: "invalid" });
  });
  it("the authz check runs before the payload is looked at", async () => {
    actor = "mem";
    expect(await updateFormAction("join", "garbage")).toEqual({ ok: false, error: "forbidden" });
  });
});
