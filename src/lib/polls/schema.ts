import { z } from "zod";
import type { PollInput } from "@/lib/mockdb/polls";

const label = z.object({ mn: z.string().max(400), en: z.string().max(400) });
const iso = z.string().max(40).nullable();

/** Shape check for the payload a Server Action receives (untrusted). Business limits live in the rule (`valid` in mockdb/polls.ts). */
export const pollInputSchema: z.ZodType<PollInput> = z.object({
  title: label, description: z.object({ mn: z.string().max(4000), en: z.string().max(4000) }),
  options: z.array(z.object({ id: z.string().max(40), label })).max(20),
  multi: z.boolean(), max_choices: z.number().int().min(0).max(100),
  audience: z.enum(["members", "community", "everyone"]), anonymous: z.boolean(),
  results: z.enum(["after_vote", "after_close", "staff_only"]), opens_at: iso, closes_at: iso,
});
