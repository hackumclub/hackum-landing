// Read side of the editable profile: what the form starts from. Pure (Db in, plain data out) so it can be unit-tested.
import type { L, Locale } from "@/i18n/config";
import type { AcademicInput } from "@/lib/mockdb/academic";
import type { Db, Profile } from "@/lib/mockdb/types";
import { previousSemester, semesterLabel, semesterOf, type Semester, type Term } from "@/lib/semester";

export type SemesterVm = { year: number; term: Term; label: string; subjects: string[]; shared: boolean; current: boolean };
export type ProfileEditVm = {
  name: L; grad_year: number | null; links: Record<string, string>; visibility: Profile["visibility"]; locale: Locale; avatar: string | null;
  academic: AcademicInput; semesters: SemesterVm[];
};

/** The current semester and the three before it, newest first. */
export function recentSemesters(now: Date, count = 4): Semester[] {
  const out: Semester[] = [semesterOf(now)];
  while (out.length < count) out.push(previousSemester(out[out.length - 1]));
  return out;
}

export function academicOf(p: Pick<Profile, "school" | "school_id" | "major" | "major_track" | "program_index">): AcademicInput {
  const school_id = p.school_id ?? "other";
  return { school_id, school_name: school_id === "other" ? (p.school ?? "") : "", major_track: p.major_track ?? "other", program_index: school_id === "num" ? p.program_index : null, major_label: p.major ?? "" };
}

export function profileEditView(db: Db, profileId: string, now: Date, lang: Locale): ProfileEditVm | null {
  const p = db.profiles.find((x) => x.id === profileId && !x.deleted_at);
  if (!p) return null;
  const cur = semesterOf(now);
  return {
    name: p.name, grad_year: p.grad_year, links: p.links, visibility: p.visibility, locale: p.locale, avatar: p.avatar_path,
    academic: academicOf(p),
    semesters: recentSemesters(now).map((s) => {
      const row = db.profile_semesters.find((r) => r.profile_id === profileId && r.year === s.year && r.term === s.term);
      return { year: s.year, term: s.term, label: semesterLabel(s, lang), subjects: row?.subjects ?? [], shared: row?.shared ?? false, current: s.year === cur.year && s.term === cur.term };
    }),
  };
}

/** What a viewer of the profile would see of the current semester's subjects (the preview and the public view agree on this). */
export const visibleSubjects = (sem: Pick<SemesterVm, "subjects" | "shared">, visibility: Profile["visibility"]): string[] =>
  sem.shared && visibility !== "private" ? sem.subjects : [];
