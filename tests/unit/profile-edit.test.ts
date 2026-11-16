// @vitest-environment node
import { describe, expect, it } from "vitest";
import { academicOf, profileEditView, recentSemesters, visibleSubjects } from "@/lib/me/profile-edit";
import { addProfile, emptyDb, NOW } from "./helpers/fixture";

describe("profile edit view", () => {
  it("lists the current semester and the 3 before it, newest first (Sep 1 and Aug 31 edges)", () => {
    expect(recentSemesters(NOW).map((s) => `${s.year}${s.term}`)).toEqual(["2026autumn", "2025spring", "2025autumn", "2024spring"]);
    expect(recentSemesters(new Date("2026-08-31T15:59:00Z"))[0]).toEqual({ year: 2025, term: "spring" }); // 23:59 UB on Aug 31
    expect(recentSemesters(new Date("2026-08-31T16:00:00Z"))[0]).toEqual({ year: 2026, term: "autumn" }); // 00:00 UB on Sep 1
  });
  it("starts from the stored subjects and flags the current semester", () => {
    const db = emptyDb(); addProfile(db, { id: "a" });
    db.profile_semesters.push({ profile_id: "a", year: 2026, term: "autumn", subjects: ["Databases"], shared: true });
    const v = profileEditView(db, "a", NOW, "en")!;
    expect(v.semesters[0]).toMatchObject({ current: true, subjects: ["Databases"], shared: true, label: "Autumn 2026" });
    expect(v.semesters[1]).toMatchObject({ current: false, subjects: [], shared: false });
    expect(profileEditView(db, "nobody", NOW, "en")).toBeNull();
  });
  it("gives the school picker a value even for an unfinished profile", () => {
    expect(academicOf({ school: "Foo", school_id: null, major: null, major_track: null, program_index: "D 1" })).toEqual({ school_id: "other", school_name: "Foo", major_track: "other", program_index: null, major_label: "" });
  });
  it("shows subjects only when shared and the profile is not private", () => {
    const sem = { subjects: ["A"], shared: true };
    expect(visibleSubjects(sem, "public")).toEqual(["A"]);
    expect(visibleSubjects(sem, "members")).toEqual(["A"]);
    expect(visibleSubjects(sem, "private")).toEqual([]);
    expect(visibleSubjects({ ...sem, shared: false }, "public")).toEqual([]);
  });
});
