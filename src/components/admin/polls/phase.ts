import type { Status } from "@/lib/status";
import type { PollPhase } from "@/lib/polls/rows";

/** A poll's phase on the shared status pill: one state, one tone, label always visible. */
export const PHASE_PILL: Record<PollPhase, Status> = { draft: "draft", scheduled: "published", open: "live", closed: "completed" };
export const phaseTone = (p: PollPhase): Status => PHASE_PILL[p];
