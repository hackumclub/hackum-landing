import {
  Archive, AtSign, Ban, BookOpen, Calendar, CalendarDays, CalendarRange, ChartColumn, Check, CircleCheck, CircleDashed, CircleX, Clock,
  Code, GraduationCap, Globe, History, Hourglass, Inbox, Info, KeyRound, Lightbulb, LayoutDashboard, ListFilter, Lock, LogOut,
  Mail, Pencil, Radio, School, Search, Send, Settings, Tent, Trophy, TriangleAlert, Upload, UserCheck, UserRound, UserX, Users, Wrench,
  Bell, FileText, type LucideIcon,
} from "lucide-react";
import type { EventKind } from "@/lib/mockdb/types";
import type { Status } from "@/lib/status";

/**
 * The one place that decides which Lucide glyph means what, so the same concept never gets two icons.
 * Rule: render at size={20} with aria-hidden, 8px gap to the text; 16px inside chips (Tag does that for you).
 */
export const icons = {
  event: CalendarDays, member: Users, form: FileText, analytics: ChartColumn, inbox: Inbox, bell: Bell, settings: Settings, audit: History,
  comms: Mail, school: School, major: BookOpen, semester: CalendarRange, passkey: KeyRound, email: AtSign, upload: Upload, filter: ListFilter,
  date: Calendar, search: Search, profile: UserRound, dashboard: LayoutDashboard, site: Globe, logout: LogOut, check: Check, warning: TriangleAlert,
  info: Info, lock: Lock,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

const KIND_ICON = {
  hackathon: Code, workshop: Wrench, meetup: Users, competition: Trophy, knowledge_day: Lightbulb, outing: Tent, other: CalendarDays,
} as const satisfies Record<EventKind, LucideIcon>;

/** Category glyph for an event kind (used inside Tag chips). */
export const eventKindIcon = (kind: EventKind): LucideIcon => KIND_ICON[kind];

const STATUS_ICON = {
  draft: Pencil, published: Globe, live: Radio, cancelled: Ban, completed: CircleCheck, archived: Archive,
  applied: Send, going: CircleCheck, waitlisted: Clock, rejected: CircleX, attended: UserCheck, no_show: UserX,
  guest: UserRound, member: Users, alumni: GraduationCap,
  pending: Hourglass, approved: CircleCheck, withdrawn: CircleDashed,
} as const satisfies Record<Status, LucideIcon>;

/** Glyph for a state (pairs with StatusPill's label; the label always stays visible). */
export const statusIcon = (status: Status): LucideIcon => STATUS_ICON[status];
