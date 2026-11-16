// Row types for the LOCAL MOCK of the Supabase schema (spec §4). Same table names, same snake_case columns, same
// enums, timestamps as ISO strings: swapping the mock for supabase-js is a change of data source, not of shapes.
import type { L, Locale } from "@/i18n/config";
import type { Answers, Question } from "@/lib/events/questions";
import type { MajorTrack, SchoolId } from "@/lib/num/schools";
import type { Term } from "@/lib/semester";
import type { ApplicationStatus, EventStatus, MemberStatus, RegStatus } from "@/lib/status";

export type EventKind = "hackathon" | "workshop" | "meetup" | "competition" | "knowledge_day" | "outing" | "other";
export type EventMode = "offline" | "online" | "hybrid";
export type EventAudience = "open" | "members" | "alumni" | "invite";
export type RegMode = "rsvp" | "application";
export type TeamMode = "none" | "optional" | "required";
export type Visibility = "public" | "members" | "private";
/** Who may register: every school, or only National University of Mongolia (МУИС) students. */
export type SchoolScope = "num" | "all";
export type Passkey = { id: string; label: string; created_at: string };
export type StaffRoleName = "organizer" | "admin";
export type NotifStatus = "queued" | "sending" | "sent" | "failed" | "skipped";
export type NotifPrefs = { reminders: boolean; updates: boolean; announcements: boolean };

export type TemplateName =
  | "welcome" | "rsvp_confirmed" | "waitlist_promoted" | "waitlist_notice" | "application_received" | "application_accepted"
  | "application_rejected" | "membership_approved" | "membership_rejected" | "event_updated" | "event_cancelled"
  | "reminder_24h" | "announcement" | "feedback_request" | "poll_opened";

export interface Profile {
  id: string;
  clerk_user_id: string | null; // null = unclaimed legacy profile
  email: string | null;
  handle: string;
  name: L;
  avatar_path: string | null;
  school: string | null; // display text
  school_id: SchoolId | null; // drives eligibility: only "num" can become a member
  major: string | null; // display text
  major_track: MajorTrack | null;
  program_index: string | null; // NUM program index, e.g. "D 061302"
  passkeys: Passkey[];
  grad_year: number | null;
  status: MemberStatus;
  visibility: Visibility;
  locale: Locale;
  links: Record<string, string>;
  notif_prefs: NotifPrefs;
  calendar_token: string;
  onboarded_at: string | null;
  created_at: string;
  last_seen_at: string | null;
  deleted_at: string | null;
}
/** Subjects a member studies in one semester; shown on the profile only when `shared`. */
export interface ProfileSemester { profile_id: string; year: number; term: Term; subjects: string[]; shared: boolean }
export type InboxKind = TemplateName | "staff_application" | "staff_failed_email";
/** The in-app notification list (bell + page). Separate from the email outbox: own retention, own read state, no budget. */
export interface InboxItem { id: string; profile_id: string; kind: InboxKind; payload: Record<string, string | number | boolean | null>; created_at: string; read_at: string | null; dedupe_key: string }
/** A site-level form staff can edit (event registration forms live on the event itself). */
export interface Form { id: "membership_application" | "join"; kind: "membership_application" | "join"; title: L; questions: Question[]; updated_at: string; updated_by: string | null }
export interface FormSubmission { id: string; form_id: "join"; profile_id: string; answers: Answers; created_at: string }
/** MOCK ONLY: profile photo bytes (base64). Supabase Storage in production. */
export type StoredAvatar = { mime: "image/png" | "image/jpeg" | "image/webp"; data: string; etag: string };
/** One person's feedback on a completed event. `anonymous` hides the author from staff views (the row still dedupes by person). */
export interface EventFeedback { id: string; event_id: string; profile_id: string; rating: number; nps: number; went_well: string; improve: string; anonymous: boolean; created_at: string; updated_at: string }
export type PollAudience = "members" | "community" | "everyone";
export type PollResultsVisibility = "after_vote" | "after_close" | "staff_only";
export type PollStatus = "draft" | "published" | "closed";
export interface PollOption { id: string; label: L }
export interface Poll {
  id: string; title: L; description: L; options: PollOption[]; multi: boolean; max_choices: number; audience: PollAudience; anonymous: boolean;
  results: PollResultsVisibility; opens_at: string | null; closes_at: string | null; status: PollStatus; created_by: string | null; created_at: string;
}
export interface PollVote { poll_id: string; profile_id: string; option_ids: string[]; created_at: string; updated_at: string }
/** MOCK ONLY: a one-time sign-in code. Clerk owns this in production, so it is never ported to Supabase. */
export interface AuthCode { email: string; code: string; attempts: number; created_at: string; expires_at: string; used_at: string | null }
export interface Membership { profile_id: string; season: number; team: string | null; role_title: L | null }
export interface StaffRole { profile_id: string; role: StaffRoleName; granted_by: string | null; granted_at: string }
export interface Season { year: number; label: L; application_opens_at: string | null; application_closes_at: string | null; is_current: boolean }

export interface EventRow {
  id: string;
  slug: string;
  kind: EventKind;
  title: L;
  tagline: L;
  description: L;
  starts_at: string;
  ends_at: string;
  tz: "Asia/Ulaanbaatar";
  approximate_date: boolean;
  mode: EventMode;
  venue_name: string | null;
  venue_address: string | null;
  online_url: string | null;
  audience: EventAudience;
  school_scope: SchoolScope;
  capacity: number | null;
  waitlist: boolean;
  reg_opens_at: string | null;
  reg_closes_at: string | null;
  status: EventStatus;
  cover_path: string | null;
  poster_path: string | null;
  themes: string[];
  external_url: string | null;
  legacy_participants: number | null;
  ics_sequence: number;
  reg_mode: RegMode;
  questions: Question[];
  team_mode: TeamMode;
  team_size_min: number;
  team_size_max: number;
  decision_deadline: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  profile_id: string;
  status: RegStatus;
  source: "web" | "admin" | "import";
  answers: Answers;
  team_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_notified_at: string | null;
  created_at: string;
  cancelled_at: string | null;
}
export interface Team { id: string; event_id: string; name: string; invite_code: string; captain_profile_id: string; looking_for: string[]; locked: boolean }

export interface MembershipApplication {
  id: string;
  profile_id: string;
  season: number;
  motivation: string;
  team_interest: string[];
  answers: Answers;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null; // staff-only
  created_at: string;
}

export interface Notification {
  id: string;
  profile_id: string | null;
  to_email: string | null; // exactly one of profile_id / to_email
  channel: "email" | "push";
  template: TemplateName;
  payload: Record<string, string | number | boolean | null>;
  priority: 0 | 1 | 2; // 0 transactional · 1 reminder · 2 announcement
  scheduled_at: string;
  status: NotifStatus;
  attempts: number;
  last_error: string | null;
  dedupe_key: string;
  sent_at: string | null;
}
export interface Subscriber { email: string; name: string; lang: Locale; source: string; created_at: string }
export interface Milestone { id: string; year: number; title: L; note: L | null; url: string | null; front_path: string | null; back_path: string | null; sort: number }
export interface AuditEntry { id: string; actor_profile_id: string | null; action: string; entity: string; entity_id: string; diff: Record<string, unknown>; at: string }

export interface Db {
  profiles: Profile[];
  memberships: Membership[];
  staff_roles: StaffRole[];
  seasons: Season[];
  events: EventRow[];
  registrations: Registration[];
  teams: Team[];
  membership_applications: MembershipApplication[];
  notifications: Notification[];
  email_daily_usage: Record<string, number>; // "YYYY-MM-DD" (UB) → emails sent
  email_suppressions: { email: string; reason: string; at: string }[];
  subscribers: Subscriber[];
  timeline_milestones: Milestone[];
  audit_log: AuditEntry[];
  profile_semesters: ProfileSemester[];
  auth_codes: AuthCode[];
  inbox: InboxItem[];
  forms: Form[];
  avatars: Record<string, StoredAvatar>;
  event_feedback: EventFeedback[];
  polls: Poll[];
  poll_votes: PollVote[];
  form_submissions: FormSubmission[];
  /** Monotonic id counter so generated ids are stable and unique across a persisted session. */
  seq: number;
}

/** Everything a rule needs: the db, who is acting (profile id; null = anonymous) and a clock. */
export interface Ctx { db: Db; actor: string | null; now: Date }
