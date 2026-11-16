// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Question } from "@/lib/events/questions";
import type { Db } from "@/lib/mockdb/types";
import { formDefinition, listForms, listResponses, orphanKeys, submitJoinForm, updateForm } from "@/lib/mockdb/forms";
import { applyForMembership } from "@/lib/mockdb/members";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, NOW } from "./helpers/fixture";

const q = (id: string, over: Partial<Question> = {}): Question => ({ id, type: "short", label: { mn: `Асуулт ${id}`, en: `Question ${id}` }, required: false, ...over });
let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "a", school_id: "num", major_track: "cs" }); addProfile(db, { id: "b" });
  db.forms = [
    { id: "membership_application", kind: "membership_application", title: { mn: "Гишүүнчлэлийн өргөдөл", en: "Membership application" }, questions: [q("exp", { type: "select", options: [{ mn: "Анхан", en: "Beginner" }, { mn: "Ахисан", en: "Advanced" }], required: true })], updated_at: at(-10), updated_by: null },
    { id: "join", kind: "join", title: { mn: "Нэгдэх", en: "Join" }, questions: [q("heard")], updated_at: at(-10), updated_by: null },
  ];
  db.seasons.push({ year: 2027, label: { mn: "2027", en: "2027" }, application_opens_at: at(-24), application_closes_at: at(24 * 30), is_current: false });
});

describe("updateForm", () => {
  it("lets staff replace the questions, stamps who and when, and audits it", () => {
    const r = updateForm(ctx(db, "org"), "join", [q("heard"), q("goal")]);
    expect(r.ok && r.data.questions.map((x) => x.id)).toEqual(["heard", "goal"]);
    expect(db.forms[1]).toMatchObject({ updated_by: "org", updated_at: NOW.toISOString() });
    expect(db.audit_log.at(-1)).toMatchObject({ action: "form.update", entity_id: "join" });
  });
  it("is staff only", () => {
    expect(updateForm(ctx(db, "a"), "join", [])).toEqual({ ok: false, error: "forbidden" });
    expect(updateForm(ctx(db, null), "join", [])).toEqual({ ok: false, error: "unauthenticated" });
  });
  it.each([
    ["21 questions", Array.from({ length: 21 }, (_, i) => q(`q${i}`))],
    ["duplicate ids", [q("x"), q("x")]],
    ["a select with one option", [q("s", { type: "select", options: [{ mn: "a", en: "a" }] })]],
    ["a blank Mongolian label", [q("x", { label: { mn: " ", en: "" } })]],
  ])("rejects %s", (_n, qs) => {
    expect(updateForm(ctx(db, "org"), "join", qs)).toEqual({ ok: false, error: "invalid" });
  });
  it("knows only the two site forms", () => {
    expect(updateForm(ctx(db, "org"), "event:e1" as never, [])).toEqual({ ok: false, error: "not_found" });
  });
});

describe("listForms and listResponses", () => {
  beforeEach(() => {
    addEvent(db, { id: "e1", questions: [q("why", { required: true })] });
    addEvent(db, { id: "e2" });
  });
  it("lists the two site forms and one registration form per event with response counts", () => {
    registerForEvent(ctx(db, "a"), { eventId: "e1", answers: { why: "Because" } });
    registerForEvent(ctx(db, "b"), { eventId: "e1", answers: { why: "Also" } });
    const forms = listForms(db);
    expect(forms.map((f) => f.id)).toEqual(expect.arrayContaining(["membership_application", "join", "event:e1", "event:e2"]));
    expect(forms.find((f) => f.id === "event:e1")).toMatchObject({ kind: "event_registration", event_id: "e1", question_count: 1, responses: 2 });
    expect(forms.find((f) => f.id === "event:e2")).toMatchObject({ responses: 0, last_response_at: null });
  });
  it("does not count cancelled registrations", () => {
    registerForEvent(ctx(db, "a"), { eventId: "e1", answers: { why: "x" } });
    db.registrations[0].status = "cancelled";
    expect(listForms(db).find((f) => f.id === "event:e1")!.responses).toBe(0);
  });
  it("returns event answers newest first with a name but never an email", () => {
    registerForEvent(ctx(db, "a"), { eventId: "e1", answers: { why: "Because" } });
    const rows = listResponses(db, "event:e1")!;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ profile_id: "a", status: "going", answers: { why: "Because" } });
    expect(JSON.stringify(rows)).not.toContain("@example.com");
    expect(listResponses(db, "event:nope")).toBeNull();
  });
  it("keeps answers to a question that was later removed and reports the orphan key", () => {
    registerForEvent(ctx(db, "a"), { eventId: "e1", answers: { why: "Because" } });
    db.events.find((e) => e.id === "e1")!.questions = [];
    const rows = listResponses(db, "event:e1")!;
    expect(rows[0].answers).toEqual({ why: "Because" });
    expect(orphanKeys(formDefinition(db, "event:e1")!.questions, rows)).toEqual(["why"]);
  });
});

describe("site forms collect answers", () => {
  it("membership answers are validated against the form and stored on the application", () => {
    const base = { motivation: "Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.", team_interest: [] as string[] };
    expect(applyForMembership(ctx(db, "a"), base)).toEqual({ ok: false, error: "invalid" }); // required "exp" missing
    expect(applyForMembership(ctx(db, "a"), { ...base, answers: { exp: "7" } })).toEqual({ ok: false, error: "invalid" }); // bad option index
    expect(applyForMembership(ctx(db, "a"), { ...base, answers: { exp: "1" } }).ok).toBe(true);
    expect(db.membership_applications[0].answers).toEqual({ exp: "1" });
    expect(listResponses(db, "membership_application")![0]).toMatchObject({ profile_id: "a", status: "pending", answers: { exp: "1" } });
  });
  it("the join form stores one validated submission per profile, newest wins", () => {
    expect(submitJoinForm(ctx(db, null), {})).toEqual({ ok: false, error: "unauthenticated" });
    expect(submitJoinForm(ctx(db, "b"), { heard: "Friend" }).ok).toBe(true);
    expect(submitJoinForm(ctx(db, "b"), { heard: "Poster" }).ok).toBe(true);
    expect(db.form_submissions).toHaveLength(1);
    expect(listResponses(db, "join")![0]).toMatchObject({ profile_id: "b", status: "submitted", answers: { heard: "Poster" } });
    expect(submitJoinForm(ctx(db, "b"), { heard: "x".repeat(201) })).toEqual({ ok: false, error: "invalid" });
  });
});
