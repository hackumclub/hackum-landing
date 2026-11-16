import { z } from "zod";
import { BODY_MAX, EVENT_STATUSES, SUBJECT_MAX } from "./compose-state";

const text = (max: number) => z.string().max(max);

export const audienceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("members") }).strict(),
  z.object({ kind: z.literal("community") }).strict(),
  z.object({ kind: z.literal("everyone") }).strict(),
  z.object({ kind: z.literal("subscribers") }).strict(),
  z.object({ kind: z.literal("event"), eventId: z.string().min(1).max(64), statuses: z.array(z.enum(EVENT_STATUSES)).min(1).max(EVENT_STATUSES.length) }).strict(),
]);

/** Plain-text bilingual copy. Mongolian is required (non-blank); English may be empty. */
const subject = z.object({ mn: text(SUBJECT_MAX).refine((s) => s.trim() !== ""), en: text(SUBJECT_MAX) }).strict();
const body = z.object({ mn: text(BODY_MAX).refine((s) => s.trim() !== ""), en: text(BODY_MAX) }).strict();

export const sendSchema = z.object({ key: z.string().trim().min(1).max(64), audience: audienceSchema, subject, body }).strict();

export const previewSchema = z.object({
  subject: z.object({ mn: text(SUBJECT_MAX * 2), en: text(SUBJECT_MAX * 2) }).strict(),
  body: z.object({ mn: text(BODY_MAX * 2), en: text(BODY_MAX * 2) }).strict(),
  lang: z.enum(["mn", "en"]),
}).strict();
