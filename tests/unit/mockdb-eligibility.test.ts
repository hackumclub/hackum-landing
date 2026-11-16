// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { applyForMembership, reviewMembership } from "@/lib/mockdb/members";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { previewEventChange, updateEvent, type EventInput } from "@/lib/mockdb/events";
import { setSemesterSubjects, updateAcademic } from "@/lib/mockdb/academic";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "num1", school_id: "num", major_track: "software" });
  addProfile(db, { id: "must1", school: "ШУТИС", school_id: "must", major_track: "other" });
  addProfile(db, { id: "nomajor", school_id: "num", major_track: null });
  db.seasons.push({ year: 2027, label: { mn: "2027", en: "2027" }, application_opens_at: at(-24), application_closes_at: at(24 * 30), is_current: false });
});
const motivation = "Би клубт нэгдэж AI төсөл хийхийг хүсэж байна.";
const apply = (actor: string) => applyForMembership(ctx(db, actor), { motivation, team_interest: [] });
const rsvp = (actor: string, eventId: string) => registerForEvent(ctx(db, actor), { eventId, answers: {} });

describe("membership is for National University of Mongolia students with a major", () => {
  it("lets a NUM student with a major apply", () => {
    expect(apply("num1").ok).toBe(true);
  });
  it("refuses another school and writes nothing", () => {
    expect(apply("must1")).toEqual({ ok: false, error: "ineligible" });
    expect(db.membership_applications).toHaveLength(0);
  });
  it("refuses a NUM student who has not chosen a major yet", () => {
    expect(apply("nomajor")).toEqual({ ok: false, error: "ineligible" });
    expect(db.membership_applications).toHaveLength(0);
  });
});

describe("school scope on events", () => {
  it("keeps a NUM-only event closed to other schools but open to NUM", () => {
    addEvent(db, { id: "e-num", school_scope: "num" });
    expect(rsvp("must1", "e-num")).toEqual({ ok: false, error: "ineligible" });
    expect(db.registrations).toHaveLength(0);
    expect(rsvp("num1", "e-num").ok).toBe(true);
  });
  it("lets every school into an all-schools event", () => {
    addEvent(db, { id: "e-all", school_scope: "all" });
    expect(rsvp("must1", "e-all").ok).toBe(true);
  });
  it("treats an unset school as not NUM", () => {
    addProfile(db, { id: "blank", school_id: null, major_track: null });
    addEvent(db, { id: "e-num", school_scope: "num" });
    expect(rsvp("blank", "e-num")).toEqual({ ok: false, error: "ineligible" });
  });
});

describe("updateAcademic", () => {
  it("stores school, track and program, and sets the display school for NUM", () => {
    const r = updateAcademic(ctx(db, "must1"), { school_id: "num", school_name: "", major_track: "cs", program_index: "D 061301", major_label: "Компьютерын ухаан" });
    expect(r.ok).toBe(true);
    expect(db.profiles.find((p) => p.id === "must1")).toMatchObject({ school_id: "num", school: "МУИС", major_track: "cs", program_index: "D 061301", major: "Компьютерын ухаан" });
  });
  it("drops a program index for a non-NUM school and keeps the typed school name for 'other'", () => {
    const r = updateAcademic(ctx(db, "num1"), { school_id: "other", school_name: "  Khovd University ", major_track: "software", program_index: "D 061302", major_label: "Software" });
    expect(r.ok).toBe(true);
    expect(db.profiles.find((p) => p.id === "num1")).toMatchObject({ school_id: "other", school: "Khovd University", program_index: null, major_track: "software" });
  });
  it.each([
    ["unknown school id", { school_id: "harvard" }],
    ["'other' without a school name", { school_id: "other", school_name: " " }],
    ["unknown track", { major_track: "art" }],
    ["81-char major label", { major_label: "x".repeat(81) }],
  ])("rejects %s", (_n, over) => {
    const base = { school_id: "num", school_name: "", major_track: "cs", program_index: null, major_label: "" };
    expect(updateAcademic(ctx(db, "num1"), { ...base, ...over } as never)).toEqual({ ok: false, error: "invalid" });
  });
  it("needs a signed-in user", () => {
    expect(updateAcademic(ctx(db, null), { school_id: "num", school_name: "", major_track: "cs", program_index: null, major_label: "" })).toEqual({ ok: false, error: "unauthenticated" });
  });
});

describe("setSemesterSubjects", () => {
  const input = (over: Record<string, unknown> = {}) => ({ year: 2026, term: "autumn" as const, subjects: ["Algorithms"], shared: true, ...over });
  it("trims, drops empties and de-duplicates case-insensitively", () => {
    const r = setSemesterSubjects(ctx(db, "num1"), input({ subjects: [" Algorithms ", "algorithms", "", "Databases"] }));
    expect(r.ok && r.data.subjects).toEqual(["Algorithms", "Databases"]);
  });
  it("upserts one row per profile and semester", () => {
    setSemesterSubjects(ctx(db, "num1"), input());
    setSemesterSubjects(ctx(db, "num1"), input({ subjects: ["Networks"], shared: false }));
    expect(db.profile_semesters).toHaveLength(1);
    expect(db.profile_semesters[0]).toMatchObject({ profile_id: "num1", subjects: ["Networks"], shared: false });
  });
  it("accepts 12 subjects and rejects 13, an 81-char subject, a bad term and a bad year", () => {
    expect(setSemesterSubjects(ctx(db, "num1"), input({ subjects: Array.from({ length: 12 }, (_, i) => `S${i}`) })).ok).toBe(true);
    for (const bad of [{ subjects: Array.from({ length: 13 }, (_, i) => `S${i}`) }, { subjects: ["x".repeat(81)] }, { term: "summer" }, { year: 1999 }]) {
      expect(setSemesterSubjects(ctx(db, "num1"), input(bad as never))).toEqual({ ok: false, error: "invalid" });
    }
  });
  it("only ever writes the acting profile's own row", () => {
    setSemesterSubjects(ctx(db, "num1"), input());
    expect(db.profile_semesters.map((r) => r.profile_id)).toEqual(["num1"]);
    expect(setSemesterSubjects(ctx(db, null), input())).toEqual({ ok: false, error: "unauthenticated" });
  });
});

describe("narrowing an event to NUM", () => {
  it("reports how many current seats belong to other schools and keeps them", () => {
    addEvent(db, { id: "e1" });
    rsvp("must1", "e1"); rsvp("num1", "e1");
    const ev = db.events.find((e) => e.id === "e1")!;
    const managed = ["id", "status", "tz", "approximate_date", "legacy_participants", "ics_sequence", "created_by", "created_at"];
    const input = Object.fromEntries(Object.entries(ev).filter(([k]) => !managed.includes(k))) as EventInput;
    const r = previewEventChange(ctx(db, "org"), "e1", { ...input, school_scope: "num" });
    expect(r).toMatchObject({ ok: true, data: { nonNumRegistrants: 1 } });
    expect(updateEvent(ctx(db, "org"), "e1", { ...input, school_scope: "num" }).ok).toBe(true);
    expect(db.registrations).toHaveLength(2);
    expect(updateEvent(ctx(db, "org"), "e1", { ...input, school_scope: "bad" as never })).toEqual({ ok: false, error: "invalid" });
  });
});

describe("reviewing a membership application", () => {
  const file = (profileId: string) => {
    db.membership_applications.push({ id: `a_${profileId}`, profile_id: profileId, season: 2027, motivation: "x".repeat(20), team_interest: [], answers: {}, status: "pending", reviewed_by: null, reviewed_at: null, review_note: null, created_at: at(-5) });
    return `a_${profileId}`;
  };
  it("refuses to approve an applicant who is not a NUM student with a major, but lets staff reject", () => {
    const id = file("must1");
    expect(reviewMembership(ctx(db, "org"), { id, approve: true, note: "" })).toEqual({ ok: false, error: "ineligible" });
    expect(db.profiles.find((p) => p.id === "must1")!.status).toBe("guest");
    expect(db.memberships).toHaveLength(0);
    expect(db.membership_applications[0].status).toBe("pending");
    expect(reviewMembership(ctx(db, "org"), { id, approve: false, note: "Members must study at NUM" }).ok).toBe(true);
  });
  it("still approves an eligible NUM student", () => {
    const id = file("num1");
    expect(reviewMembership(ctx(db, "org"), { id, approve: true, note: "" }).ok).toBe(true);
    expect(db.profiles.find((p) => p.id === "num1")!.status).toBe("member");
  });
});
