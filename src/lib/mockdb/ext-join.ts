// "Create account" on the public Join form: one RPC that proves the email, creates the guest account and files what the
// person filled in. Composed from existing rules so every guard (eligibility, season window, answers) stays in one place.
import type { L, Locale } from "@/i18n/config";
import { parseAnswers, type Answers } from "@/lib/events/questions";
import { isMajorTrack, isSchoolId } from "@/lib/num/schools";
import { err, ok, type Result } from "@/lib/result";
import { updateAcademic, type AcademicInput, MAJOR_LABEL_MAX } from "./academic";
import { verifyEmailCode } from "./auth";
import { subscribe, normaliseSignup } from "./ext-subscribe";
import { submitJoinForm } from "./forms";
import { applyForMembership, openSeason } from "./members";
import type { Ctx, Db } from "./types";

export type JoinInput = {
  email: string;
  locale: Locale;
  name: L;
  academic: AcademicInput;
  /** Answers to the club's own join questions (`forms.join`). */
  answers: unknown;
  /** NUM students only: a motivation of 10+ characters files a membership application when a season is open. */
  motivation: string;
  team_interest: string[];
  /** Answers to the membership questions (`forms.membership_application`), used only when an application is filed. */
  membership_answers: unknown;
};

/** Machine codes per field; the form maps them to copy. Question errors are keyed by question id. */
export type JoinFieldErrors = {
  name?: string; email?: string; school_id?: string; school_name?: string; major_track?: string; major_label?: string;
  answers?: Record<string, string>; motivation?: string; membership_answers?: Record<string, string>;
};
export type JoinOutcome = { profile_id: string; created: boolean; membership: "applied" | "none" };

/** NUM students who picked a major can apply for membership; everyone else joins as a guest. */
export const canApply = (a: Pick<AcademicInput, "school_id" | "major_track">) => a.school_id === "num" && isMajorTrack(a.major_track);

type Valid = { ok: true; answers: Answers; apply: { motivation: string; answers: Answers } | null };

/** Everything the form can get wrong, checked without touching the database. Used before a code is sent and again before the account is created. */
export function validateJoin(db: Db, now: Date, i: JoinInput): Valid | { ok: false; errors: JoinFieldErrors } {
  const errors: JoinFieldErrors = {};
  const mn = i.name.mn.trim(); const en = i.name.en.trim();
  if (!mn && !en) errors.name = "required";
  else if (mn.length > 80 || en.length > 80) errors.name = "too_long";
  if (!normaliseSignup(mn || en || "x", i.email)) errors.email = "invalid";

  const a = i.academic;
  if (!isSchoolId(a.school_id)) errors.school_id = "required";
  if (!isMajorTrack(a.major_track)) errors.major_track = "required";
  if (a.school_id === "other" && !a.school_name.trim()) errors.school_name = "required";
  if (a.school_name.trim().length > 80) errors.school_name = "too_long";
  if (a.major_label.trim().length > MAJOR_LABEL_MAX) errors.major_label = "too_long";

  const joinQuestions = db.forms.find((f) => f.id === "join")?.questions ?? [];
  const joined = parseAnswers(joinQuestions, i.answers ?? {});
  if (!joined.ok) errors.answers = joined.errors;

  // The application is optional: it exists only for a NUM student who wrote a motivation while a season is open.
  const motivation = i.motivation.trim();
  let apply: Valid["apply"] = null;
  if (canApply(a) && motivation.length > 0 && isSeasonOpen(db, now)) {
    const questions = db.forms.find((f) => f.id === "membership_application")?.questions ?? [];
    const extra = parseAnswers(questions, i.membership_answers ?? {});
    if (motivation.length < 10) errors.motivation = "too_short";
    else if (motivation.length > 1000) errors.motivation = "too_long";
    if (!extra.ok) errors.membership_answers = extra.errors;
    if (extra.ok && !errors.motivation) apply = { motivation, answers: extra.data };
  }
  if (Object.keys(errors).length > 0 || !joined.ok) return { ok: false, errors };
  return { ok: true, answers: joined.data, apply };
}

const isSeasonOpen = (db: Db, now: Date) => openSeason({ db, actor: null, now }) !== null;

/**
 * Verifies the emailed code and creates the account. An email that already has an account is only signed in (nothing on
 * that profile changes), so the form cannot be used to rewrite someone's school. Validation runs before the code is spent.
 */
export function createAccount(ctx: Ctx, code: string, input: JoinInput): Result<JoinOutcome> {
  const v = validateJoin(ctx.db, ctx.now, input);
  if (!v.ok) return err("invalid");
  const name = { mn: input.name.mn.trim() || input.name.en.trim(), en: input.name.en.trim() };
  const verified = verifyEmailCode(ctx, input.email, code, { name, locale: input.locale });
  if (!verified.ok) return verified;
  const { profile_id, created } = verified.data;
  if (!created) return ok({ profile_id, created, membership: "none" });

  const me: Ctx = { ...ctx, actor: profile_id };
  const academic = updateAcademic(me, input.academic);
  if (!academic.ok) return academic;
  const submitted = submitJoinForm(me, v.answers);
  if (!submitted.ok) return submitted;
  if (v.apply) {
    const filed = applyForMembership(me, { motivation: v.apply.motivation, team_interest: input.team_interest, answers: v.apply.answers });
    if (filed.ok) return ok({ profile_id, created, membership: "applied" });
  }
  // Not applying (other school, no motivation, window closed): keep them on the newsletter so they hear when it opens.
  subscribe(me, { name: name.mn, email: input.email, lang: input.locale, source: "join_page" });
  return ok({ profile_id, created, membership: "none" });
}
