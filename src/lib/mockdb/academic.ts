import { err, ok, type Result } from "@/lib/result";
import { isMajorTrack, isSchoolId, SCHOOLS, type MajorTrack, type SchoolId } from "@/lib/num/schools";
import { isTerm, type Term } from "@/lib/semester";
import { audit, requireProfile } from "./core";
import type { Ctx, ProfileSemester } from "./types";

export const MAX_SUBJECTS = 12;
export const SUBJECT_MAX = 80;
export const MAJOR_LABEL_MAX = 80;
const SCHOOL_NAME_MAX = 80;

export type AcademicInput = { school_id: SchoolId; school_name: string; major_track: MajorTrack; program_index: string | null; major_label: string };

/** School and major of the acting profile. Only NUM has a program list, so a program index is kept for NUM alone. */
export function updateAcademic(ctx: Ctx, input: AcademicInput): Result<void> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  if (!isSchoolId(input.school_id) || !isMajorTrack(input.major_track)) return err("invalid");
  const schoolName = input.school_name.trim();
  const label = input.major_label.trim();
  if (label.length > MAJOR_LABEL_MAX || schoolName.length > SCHOOL_NAME_MAX) return err("invalid");
  if (input.school_id === "other" && schoolName.length < 1) return err("invalid");
  const program = input.school_id === "num" ? (input.program_index?.trim() || null) : null;
  if (program && program.length > 20) return err("invalid");
  const school = input.school_id === "other" ? schoolName : (SCHOOLS.find((s) => s.id === input.school_id)?.name.mn ?? schoolName);
  Object.assign(me.data, { school_id: input.school_id, school, major_track: input.major_track, program_index: program, major: label || null });
  audit(ctx, "profile.academic", "profiles", me.data.id, { school_id: input.school_id, major_track: input.major_track });
  return ok(undefined);
}

export function setSemesterSubjects(ctx: Ctx, input: { year: number; term: Term; subjects: string[]; shared: boolean }): Result<ProfileSemester> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100 || !isTerm(input.term)) return err("invalid");
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const raw of input.subjects) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > SUBJECT_MAX) return err("invalid");
    if (seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    subjects.push(s);
  }
  if (subjects.length > MAX_SUBJECTS) return err("invalid");
  const row = ctx.db.profile_semesters.find((r) => r.profile_id === me.data.id && r.year === input.year && r.term === input.term);
  const next: ProfileSemester = { profile_id: me.data.id, year: input.year, term: input.term, subjects, shared: !!input.shared };
  if (row) Object.assign(row, next); else ctx.db.profile_semesters.push(next);
  return ok(next);
}
