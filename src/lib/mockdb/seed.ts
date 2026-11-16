// Deterministic seed for the LOCAL MOCK of the Supabase schema (spec §4). Everything is derived from `now` and a fixed PRNG
// seed: no Math.random, no Date.now. Names, emails and handles are plainly fictional (example.* domains only).
import { nextId } from "./core";
import type { MajorTrack, SchoolId } from "@/lib/num/schools";
import type { L, Locale } from "@/i18n/config";
import type { Answers, Question } from "@/lib/events/questions";
import type { MemberStatus, RegStatus } from "@/lib/status";
import type {
  AuditEntry, Db, EventRow, Form, FormSubmission, InboxItem, Membership, MembershipApplication, Milestone, Notification, Profile, ProfileSemester, Registration, Season,
  StaffRole, Subscriber, Team, TemplateName, Visibility,
} from "./types";

/** Dev personas for the persona switcher (handles resolve to seeded profiles). */
export const PERSONAS: { handle: string; label: L; role: string }[] = [
  { handle: "dev-admin", label: { mn: "Хөгжүүлэлтийн админ", en: "Dev admin" }, role: "admin" },
  { handle: "dev-organizer", label: { mn: "Хөгжүүлэлтийн зохион байгуулагч", en: "Dev organizer" }, role: "organizer" },
  { handle: "anuujin", label: { mn: "Гишүүн (Ануужин)", en: "Member (Anuujin)" }, role: "member" },
  { handle: "temuulen", label: { mn: "Зочин (Тэмүүлэн)", en: "Guest (Temuulen)" }, role: "guest" },
  { handle: "saraa", label: { mn: "Төгсөгч (Сараа)", en: "Alumni (Saraa)" }, role: "alumni" },
  { handle: "bayar", label: { mn: "Зочин (Баяр, МУИС)", en: "Guest (Bayar, NUM)" }, role: "guest" },
  { handle: "new-guest", label: { mn: "Шинэ зочин (бүртгэл дуусаагүй)", en: "New guest (not onboarded)" }, role: "guest" },
];

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const UB_OFFSET = 8 * HOUR; // Asia/Ulaanbaatar, no DST
const TEAM_NAMES = ["Marketing", "Dev", "Design", "Events", "Content", "Mentors"] as const;
const PRNG_SEED = 0x48414b55;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** [mn, en] pairs. Family entries are the Mongolian patronymic (genitive of the father's name) + its transliteration. */
type Pair = readonly [mn: string, en: string];
const GIVEN: readonly Pair[] = [
  ["Анужин", "Anujin"], ["Билгүүн", "Bilguun"], ["Эрдэнэ", "Erdene"], ["Номин", "Nomin"], ["Золжаргал", "Zoljargal"],
  ["Мөнхжин", "Munkhjin"], ["Тулга", "Tulga"], ["Ану", "Anu"], ["Баярмаа", "Bayarmaa"], ["Одгэрэл", "Odgerel"],
  ["Дөлгөөн", "Dulguun"], ["Хулан", "Khulan"], ["Мишээл", "Misheel"], ["Батболд", "Batbold"], ["Ариунзаяа", "Ariunzaya"],
  ["Эрдэнэбилэг", "Erdenebileg"], ["Содгэрэл", "Sodgerel"], ["Түвшинбаяр", "Tuvshinbayar"], ["Энхжин", "Enkhjin"],
  ["Нандин", "Nandin"], ["Хишигбаяр", "Khishigbayar"], ["Цэнгүүн", "Tsenguun"], ["Уянга", "Uyanga"], ["Мандухай", "Mandukhai"],
  ["Оюунчимэг", "Oyunchimeg"], ["Ганзориг", "Ganzorig"], ["Амарбаясгалан", "Amarbayasgalan"], ["Тэлмэн", "Telmen"],
  ["Лхагва", "Lkhagva"], ["Наранцэцэг", "Narantsetseg"], ["Бүжин", "Bujin"], ["Алтангэрэл", "Altangerel"],
  ["Мөнх-Эрдэнэ", "Munkh-Erdene"], ["Сүхбаатар", "Sukhbaatar"], ["Чинзориг", "Chinzorig"], ["Дэлгэрмаа", "Delgermaa"],
  ["Хонгорзул", "Khongorzul"], ["Идэр", "Ider"], ["Зоригт", "Zorigt"], ["Жавхлан", "Javkhlan"], ["Сэргэлэн", "Sergelen"],
  ["Цогт", "Tsogt"], ["Ундраа", "Undraa"], ["Бат-Очир", "Bat-Ochir"], ["Тамир", "Tamir"], ["Эгшиглэн", "Egshiglen"],
  ["Билгэ", "Bilge"], ["Отгонбаяр", "Otgonbayar"], ["Болормаа", "Bolormaa"], ["Ууганбаяр", "Uuganbayar"],
  ["Өлзийбаяр", "Ulziibayar"], ["Өсөхбаяр", "Usukhbayar"], ["Үнэнбаяр", "Unenbayar"], ["Үүрцайх", "Uurtsaikh"],
  ["Мөнхцэцэг", "Munkhtsetseg"], ["Гэрэлмаа", "Gerelmaa"],
];
const FAMILY: readonly Pair[] = [
  ["Болдын", "Bold"], ["Баттулгын", "Battulga"], ["Доржийн", "Dorj"], ["Ганбаатарын", "Ganbaatar"], ["Эрдэнийн", "Erdene"],
  ["Нямын", "Nyam"], ["Пүрэвийн", "Purev"], ["Түмэний", "Tumen"], ["Лхагвын", "Lkhagva"], ["Цэрэнгийн", "Tsereng"],
  ["Сүхийн", "Sukh"], ["Мөнхийн", "Munkh"], ["Бямбын", "Byamba"], ["Чимэдийн", "Chimed"], ["Энхийн", "Enkh"],
  ["Баатарын", "Baatar"], ["Ойдовын", "Oidov"], ["Жамъяны", "Jamyan"], ["Намсрайн", "Namsrai"], ["Гантөмрийн", "Gantumur"],
  ["Бадамын", "Badam"], ["Содномын", "Sodnom"], ["Базарын", "Bazar"], ["Дашийн", "Dash"], ["Өлзийн", "Ulzii"],
  ["Үйлсийн", "Uils"],
];
const SCHOOLS = ["МУИС · ХШУИС", "МУИС · ШУС", "ШУТИС", "ШУТИС · МТЭС", "МУБИС", "ХААИС"] as const;
const NUM_SCHOOLS = ["МУИС · ХШУИС", "МУИС · ШУС"] as const;
const TRACK_OF_MAJOR: Record<string, MajorTrack> = {
  "Программ хангамж": "software", "Компьютерийн ухаан": "cs", "Мэдээллийн систем": "is", "Мэдээллийн технологи": "it",
};
const MAJORS = [
  "Мэдээллийн технологи", "Программ хангамж", "Компьютерийн ухаан", "Цахилгаан, электроник", "Мэдээлэл зүй",
  "Мэдээллийн систем", "Дата шинжлэх ухаан", "График дизайн",
] as const;
const ROLE_TITLES: readonly L[] = [
  { mn: "Багийн ахлагч", en: "Team lead" }, { mn: "Туслах", en: "Assistant" },
  { mn: "Ментор", en: "Mentor" }, { mn: "Зохион байгуулагч", en: "Organizer" },
];
const MOTIVATIONS: readonly string[] = [
  "Би Hackum клубийн бодит төсөл дээр суурилсан сурах орчинд орж, багаар ажиллах туршлага хуримтлуулахыг хүсэж байна.",
  "Өмнөх хакатонд оролцож байсан тул одоо зохион байгуулагчийн талаас нь хувь нэмрээ оруулахыг хүсэж байна.",
  "Дизайны чадвараа хөгжүүлж, клубийн брэнд болон арга хэмжээний материалыг бүтээхэд оролцмоор байна.",
  "Машин сургалт, RAG системийн чиглэлээр ижил сонирхолтой найзуудтай танилцаж, хамтдаа туршилт хийхийг зорьж байна.",
  "Арга хэмжээний зохион байгуулалт, ивэнт менежментэд туршлага хуримтлуулахыг хүсэж байна.",
  "Контент бичих, сошиал медиа удирдах чиглэлээр клубт хувь нэмэр оруулахад бэлэн байна.",
  "Ахлах курсийн оюутнуудаас суралцаж, дараа нь өөрөө бусдад ментор болохыг зорьж байна.",
  "Хакатон зохион байгуулахад тусалж, түнш байгууллагуудтай харилцах ажилд оролцохыг хүсэж байна.",
];
const SKILLS: readonly string[] = [
  "Python, FastAPI, PostgreSQL", "React, TypeScript, Figma", "Go, gRPC, Docker", "Машин сургалт, PyTorch", "Flutter, Firebase",
  "UI/UX дизайн, Figma", "C++, embedded", "Data analysis, SQL, Power BI", "Next.js, Tailwind, Supabase", "Java, Spring Boot",
  "Computer vision, OpenCV", "Pitching, product management",
];
const LOOKING_FOR = ["Designer", "Frontend", "Backend", "ML engineer", "Pitch lead"] as const;
const TEAM_LABELS = [
  "Null Pointers", "Алтан Код", "Byte Nomads", "Хөх Тэнгэр", "Gobi Stack", "Сэргэлэн Баг", "Token Taxi", "Ураг Дата",
  "Yurt Ops", "Мөнгөн Үүл", "Segfault Squad", "Эрдэнэ Лаб", "Dead Letter Queue", "Хүрэн Хэш", "Cold Start", "Ger Hub",
] as const;
const INVITE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function buildSeed(now: Date): Db {
  const nowMs = now.getTime();
  const rng = mulberry32(PRNG_SEED);
  let seq = 0;
  const nid = (prefix: string) => `${prefix}_${++seq}`;

  // ---- helpers -------------------------------------------------------------------------------------------------
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const chance = (p: number) => rng() < p;
  const at = <T>(xs: readonly T[], i: number): T => {
    const v = xs[i];
    if (v === undefined) throw new Error(`seed: index ${i} out of range`);
    return v;
  };
  const pick = <T>(xs: readonly T[]): T => at(xs, int(0, xs.length - 1));
  const shuffle = <T>(xs: readonly T[]): T[] => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = int(0, i);
      const tmp = at(a, i);
      a[i] = at(a, j);
      a[j] = tmp;
    }
    return a;
  };
  const iso = (ms: number) => new Date(ms).toISOString();
  const sec = (ms: number) => Math.floor(ms / 1000) * 1000;
  const between = (lo: number, hi: number) => sec(lo + rng() * (hi - lo));
  /** Epoch ms of UB wall-clock hh:mm on the UB calendar day `dayOffset` days from now. */
  const ubAt = (dayOffset: number, hh: number, mm = 0) => {
    const ub = new Date(nowMs + UB_OFFSET);
    return Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate() + dayOffset, hh, mm) - UB_OFFSET;
  };
  const ubDayKey = (daysAgo: number) => new Date(nowMs + UB_OFFSET - daysAgo * DAY).toISOString().slice(0, 10);
  const token = (handle: string) => {
    const r = mulberry32(fnv1a(handle));
    return Array.from({ length: 4 }, () => Math.floor(r() * 4294967296).toString(16).padStart(8, "0")).join("");
  };
  const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ---- profiles ------------------------------------------------------------------------------------------------
  const profiles: Profile[] = [];
  const usedHandles = new Set<string>();
  const usedTokens = new Set<string>();
  let nameIdx = 0;

  interface ProfileOpts {
    handle: string;
    name: L;
    status: MemberStatus;
    claimed?: boolean;
    onboarded?: boolean;
    grad: number | null;
    createdAgo: number;
    seenAgo: number | null;
    locale?: Locale;
    visibility?: Visibility;
    announcements?: boolean;
    bare?: boolean; // no school/major (not onboarded yet)
  }
  const mkProfile = (o: ProfileOpts): Profile => {
    usedHandles.add(o.handle);
    let tok = token(o.handle);
    for (let i = 1; usedTokens.has(tok); i++) tok = token(`${o.handle}#${i}`);
    usedTokens.add(tok);
    const claimed = o.claimed ?? true;
    const onboarded = o.onboarded ?? true;
    // Only NUM students can be members or alumni; guests come from any school.
    const school = o.bare ? null : o.status === "guest" ? pick(SCHOOLS) : pick(NUM_SCHOOLS);
    const major = o.bare ? null : pick(MAJORS);
    const domain = chance(0.6) ? "example.edu.mn" : "example.com";
    const created = nowMs - o.createdAgo;
    const p: Profile = {
      id: nid("p"),
      clerk_user_id: claimed ? `user_${o.handle}` : null,
      email: claimed ? `${o.handle}@${domain}` : null,
      handle: o.handle,
      name: o.name,
      avatar_path: null,
      school,
      school_id: school === null ? null : school.startsWith("МУИС") ? "num" : school.startsWith("ШУТИС") ? "must" : "other",
      major,
      major_track: major === null ? null : (TRACK_OF_MAJOR[major] ?? "other"),
      program_index: null,
      passkeys: [],
      grad_year: o.bare ? null : o.grad,
      status: o.status,
      visibility: o.visibility ?? (claimed ? pick<Visibility>(["public", "public", "members", "members", "private"]) : "public"),
      locale: o.locale ?? (chance(0.2) ? "en" : "mn"),
      links: chance(0.3) ? { website: `https://example.com/${o.handle}` } : {},
      notif_prefs: { reminders: true, updates: true, announcements: o.announcements ?? true },
      calendar_token: tok,
      onboarded_at: onboarded ? iso(created + int(2, 55) * MIN) : null,
      created_at: iso(created),
      last_seen_at: o.seenAgo === null ? null : iso(nowMs - o.seenAgo),
      deleted_at: null,
    };
    profiles.push(p);
    return p;
  };
  const genName = (): { handle: string; name: L } => {
    nameIdx++;
    const given = pick(GIVEN);
    const fam = pick(FAMILY);
    const base = kebab(`${given[1]}-${fam[1]}`);
    let handle = base;
    for (let n = 2; usedHandles.has(handle); n++) handle = `${base}-${n}`;
    return { handle, name: { mn: `${fam[0]} ${given[0]}`, en: `${given[1]} ${fam[1]}` } };
  };
  const seen = () => (chance(0.75) ? int(5, 30 * 24 * 60) * MIN : null);
  const announcementsFor = () => nameIdx % 23 !== 7;

  const admin = mkProfile({ handle: "dev-admin", name: { mn: "Хөгжүүлэгч Админ", en: "Dev Admin" }, status: "member", grad: 2026, createdAgo: 400 * DAY, seenAgo: 10 * MIN, locale: "en", visibility: "members" });
  const organizer = mkProfile({ handle: "dev-organizer", name: { mn: "Хөгжүүлэгч Зохион байгуулагч", en: "Dev Organizer" }, status: "member", grad: 2026, createdAgo: 400 * DAY, seenAgo: 2 * HOUR, locale: "mn", visibility: "members" });
  const anuujin = mkProfile({ handle: "anuujin", name: { mn: "Болдын Ануужин", en: "Anuujin Bold" }, status: "member", grad: 2027, createdAgo: 300 * DAY, seenAgo: HOUR, visibility: "public" });
  const temuulen = mkProfile({ handle: "temuulen", name: { mn: "Доржийн Тэмүүлэн", en: "Temuulen Dorj" }, status: "guest", grad: 2028, createdAgo: 40 * DAY, seenAgo: 3 * HOUR, visibility: "members" });
  const saraa = mkProfile({ handle: "saraa", name: { mn: "Ганбаатарын Сараа", en: "Saraa Ganbaatar" }, status: "alumni", grad: 2024, createdAgo: 200 * DAY, seenAgo: 2 * DAY, locale: "en", visibility: "public" });
  const bayar = mkProfile({ handle: "bayar", name: { mn: "Лхагвын Баяр", en: "Bayar Lkhagva" }, status: "guest", grad: 2028, createdAgo: 12 * DAY, seenAgo: 6 * HOUR, visibility: "members" });
  mkProfile({ handle: "new-guest", name: { mn: "", en: "" }, status: "guest", grad: null, onboarded: false, bare: true, createdAgo: 20 * MIN, seenAgo: 5 * MIN, visibility: "members" });

  const academic = (p: Profile, school: string, school_id: SchoolId, major: string, major_track: MajorTrack, program_index: string | null = null) =>
    Object.assign(p, { school, school_id, major, major_track, program_index });
  academic(admin, "МУИС · ШУС", "num", "Компьютерийн ухаан", "cs", "D 061301");
  academic(organizer, "МУИС · ШУС", "num", "Мэдээллийн технологи", "it", "D 061304");
  academic(anuujin, "МУИС · ШУС", "num", "Программ хангамж", "software", "D 061302");
  academic(temuulen, "ШУТИС", "must", "Мэдээллийн технологи", "it");
  academic(bayar, "МУИС · ШУС", "num", "Программ хангамж", "software", "D 061302");
  academic(saraa, "МУИС · ШУС", "num", "Компьютерийн ухаан", "cs", "D 061301");

  const members: Profile[] = [];
  for (let i = 0; i < 37; i++) {
    const n = genName();
    members.push(mkProfile({ ...n, status: "member", grad: int(2026, 2029), createdAgo: int(10, 400) * DAY, seenAgo: seen(), announcements: announcementsFor() }));
  }
  const guests: Profile[] = [];
  for (let i = 0; i < 69; i++) {
    const n = genName();
    guests.push(mkProfile({ ...n, status: "guest", grad: i === 0 ? 2030 : int(2026, 2030), createdAgo: int(3, 300) * DAY, seenAgo: seen(), announcements: announcementsFor() }));
  }
  const alumni: Profile[] = [];
  for (let i = 0; i < 19; i++) {
    const n = genName();
    alumni.push(mkProfile({ ...n, status: "alumni", grad: i === 0 ? 2018 : int(2018, 2025), createdAgo: int(20, 380) * DAY, seenAgo: seen(), announcements: announcementsFor() }));
  }
  const legacy: Profile[] = [];
  for (let i = 0; i < 8; i++) {
    const n = genName();
    legacy.push(mkProfile({ ...n, status: "alumni", claimed: false, grad: int(2018, 2022), createdAgo: 120 * DAY, seenAgo: null, visibility: "public" }));
  }
  const orgExtra = at(members, 0);
  const approvedApplicants = members.slice(1, 4); // recently approved for season 2027

  const claimedPool = profiles.filter((p) => p.clerk_user_id && p.onboarded_at && p.handle !== "dev-admin" && p.handle !== "dev-organizer");
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // ---- staff roles, seasons, memberships -----------------------------------------------------------------------
  const staff_roles: StaffRole[] = [
    { profile_id: admin.id, role: "admin", granted_by: null, granted_at: iso(nowMs - 250 * DAY) },
    { profile_id: organizer.id, role: "organizer", granted_by: admin.id, granted_at: iso(nowMs - 249 * DAY) },
    { profile_id: orgExtra.id, role: "organizer", granted_by: admin.id, granted_at: iso(nowMs - 120 * DAY) },
  ];

  const seasonYears = [2023, 2024, 2025, 2026, 2027];
  const seasons: Season[] = seasonYears.map((year) => ({
    year,
    label: { mn: `${year} оны улирал`, en: `Season ${year}` },
    application_opens_at: year === 2027 ? iso(nowMs - 14 * DAY) : null,
    application_closes_at: year === 2027 ? iso(nowMs + 35 * DAY) : null,
    is_current: year === 2026,
  }));

  const memberships: Membership[] = [];
  const addRange = (p: Profile, from: number, to: number, team: string | null, role: L | null) => {
    for (let y = from; y <= to; y++) memberships.push({ profile_id: p.id, season: y, team: team === null ? null : chance(0.75) ? team : pick(TEAM_NAMES), role_title: y === to ? role : null });
  };
  const randomRole = (team: string): L | null => (team === "Mentors" ? at(ROLE_TITLES, 2) : chance(0.3) ? pick(ROLE_TITLES) : null);
  addRange(admin, 2024, 2026, "Events", { mn: "Ерөнхийлөгч", en: "President" });
  addRange(organizer, 2025, 2026, "Events", { mn: "Зохион байгуулагч", en: "Organizer" });
  addRange(orgExtra, 2024, 2026, "Events", { mn: "Зохион байгуулагч", en: "Organizer" });
  addRange(anuujin, 2025, 2026, "Dev", null);
  addRange(saraa, 2023, 2024, "Design", { mn: "Дизайны ахлагч", en: "Design lead" });
  for (const p of members) {
    if (p === orgExtra || p === anuujin || approvedApplicants.includes(p)) continue;
    const n = int(1, 4);
    const team = pick(TEAM_NAMES);
    addRange(p, 2026 - n + 1, 2026, team, randomRole(team));
  }
  for (const p of [...alumni, ...legacy]) {
    const last = int(2023, 2025);
    const n = int(1, last - 2023 + 1);
    const team = pick(TEAM_NAMES);
    addRange(p, last - n + 1, last, team, randomRole(team));
  }

  // ---- events --------------------------------------------------------------------------------------------------
  const none: L = { mn: "", en: "" };
  const events: EventRow[] = [];
  const mkEvent = (o: Partial<EventRow> & Pick<EventRow, "slug" | "kind" | "title" | "starts_at" | "ends_at" | "status">): EventRow => {
    const row: EventRow = {
    id: nid("e"),
    tagline: none,
    description: none,
    tz: "Asia/Ulaanbaatar",
    approximate_date: false,
    mode: "offline",
    venue_name: null,
    venue_address: null,
    online_url: null,
    audience: "open",
    school_scope: "all",
    capacity: null,
    waitlist: false,
    reg_opens_at: null,
    reg_closes_at: null,
    cover_path: null,
    poster_path: null,
    themes: [],
    external_url: null,
    legacy_participants: null,
    ics_sequence: 0,
    reg_mode: "rsvp",
    questions: [],
    team_mode: "none",
    team_size_min: 1,
    team_size_max: 1,
    decision_deadline: null,
    created_by: organizer.id,
    created_at: iso(nowMs - 30 * DAY),
    ...o,
    };
    events.push(row);
    return row;
  };

  interface LegacyDef {
    slug: string; title: string; kind: EventRow["kind"]; tagline: L; description: L; ymd: [number, number, number]; approx: boolean;
    days: number; participants: number; themes: string[]; cover: string; poster: string; mode?: EventRow["mode"]; venue: string | null;
  }
  const LEGACY: LegacyDef[] = [
    { slug: "hackathon-2018", title: "Hackathon 2018", kind: "hackathon", ymd: [2018, 11, 10], approx: true, days: 2, participants: 120, themes: ["Fintech", "Education"], cover: "/img/club/hackathon-2018.jpg", poster: "/img/club/hackathon-2018.jpg", venue: "МУИС · Spartan заал",
      tagline: { mn: "Hackum-ийн анхны их хакатон", en: "Hackum's first big hackathon" },
      description: { mn: "МУИС-ийн оюутнуудын зохион байгуулсан анхны хакатон. 30 гаруй баг 24 цагийн дотор санхүү, боловсролын шийдэл бүтээв.", en: "The first hackathon organised by NUM students: 30+ teams built finance and education prototypes in 24 hours." } },
    { slug: "opendata-hackathon-2019", title: "OpenData Hackathon 2019", kind: "hackathon", ymd: [2019, 4, 13], approx: true, days: 1, participants: 90, themes: ["Open data", "Civic tech"], cover: "/img/club/opendata-2019.jpg", poster: "/img/club/opendata-2019.jpg", venue: "ШУТИС · Номын сангийн танхим",
      tagline: { mn: "Нээлттэй өгөгдлөөр нийгмийн асуудал шийдье", en: "Solving civic problems with open data" },
      description: { mn: "Төрийн нээлттэй өгөгдлийг ашиглан хот, агаарын чанар, тээврийн асуудлаар прототип бүтээсэн нэг өдрийн хакатон.", en: "A one-day hackathon building prototypes on city, air-quality and transport problems from open government data." } },
    { slug: "digital-hackathon-2019", title: "Digital Hackathon 2019", kind: "hackathon", ymd: [2019, 11, 9], approx: true, days: 2, participants: 150, themes: ["Digital transformation", "Startups"], cover: "/img/club/digital-2019.jpg", poster: "/img/club/digital-2019.jpg", venue: "МУИС · 1-р байр",
      tagline: { mn: "Дижитал шилжилтийн хоёр өдөр", en: "Two days of digital transformation" },
      description: { mn: "Салбарын менторуудтай хамт дижитал бүтээгдэхүүн хөгжүүлсэн хакатон. Шилдэг баг стартап хөтөлбөрт шалгарсан.", en: "A hackathon with industry mentors; the winning team was admitted into a startup programme." } },
    { slug: "online-hackathon-2020", title: "Online Hackathon 2020", kind: "hackathon", ymd: [2020, 5, 16], approx: true, days: 2, participants: 200, themes: ["Remote", "COVID-19"], cover: "/img/posters/online-hackathon-2020.jpg", poster: "/img/posters/online-hackathon-2020.jpg", mode: "online", venue: null,
      tagline: { mn: "Карантины үеийн онлайн хакатон", en: "The lockdown-era online hackathon" },
      description: { mn: "Бүх оролцогч гэрээсээ холбогдож, хоёр өдрийн дотор багаараа төсөл бүтээсэн Hackum-ийн анхны онлайн хакатон.", en: "Hackum's first fully online hackathon: every participant joined from home and shipped a team project in two days." } },
    { slug: "digital-num-appathon-2023", title: "Digital NUM Appathon 2023", kind: "hackathon", ymd: [2023, 10, 14], approx: false, days: 1, participants: 110, themes: ["Mobile", "Campus life"], cover: "/img/club/appathon-2023.jpg", poster: "/img/club/appathon-2023.jpg", venue: "МУИС · 2-р байр",
      tagline: { mn: "Оюутны амьдралд зориулсан апп", en: "Apps for student life" },
      description: { mn: "Кампусын амьдралыг хөнгөвчлөх мобайл апп бүтээсэн нэг өдрийн апптон.", en: "A one-day appathon building mobile apps that make campus life easier." } },
    { slug: "xacbank-hackathon-2024", title: "XacBank Hackathon 2024", kind: "hackathon", ymd: [2024, 3, 16], approx: false, days: 2, participants: 140, themes: ["Fintech", "Banking"], cover: "/img/club/xac-2024.jpg", poster: "/img/club/xac-2024.jpg", venue: "ШУТИС · Нийтийн байр",
      tagline: { mn: "Банк санхүүгийн шийдэл бүтээе", en: "Building banking and fintech solutions" },
      description: { mn: "Түнш байгууллагын бодит кейсүүд дээр 36 баг өрсөлдсөн хакатон.", en: "A hackathon where 36 teams competed on real cases supplied by a partner organisation." } },
    { slug: "c-battle-2025", title: "C Battle 2025", kind: "competition", ymd: [2025, 4, 12], approx: false, days: 1, participants: 64, themes: ["C", "Algorithms"], cover: "/img/club/cbattle-2025.jpg", poster: "/img/posters/cbattle.jpg", venue: "МУИС · Компьютерийн лаборатори",
      tagline: { mn: "C хэлний програмчлалын тэмцээн", en: "A C programming contest" },
      description: { mn: "Алгоритм, санах ойн менежментийн бодлогуудыг хурдан бодох нэг өдрийн тэмцээн.", en: "A one-day contest of fast algorithm and memory-management problems in C." } },
    { slug: "typerace-2026", title: "Typerace 2026", kind: "competition", ymd: [2026, 3, 7], approx: false, days: 1, participants: 80, themes: ["Typing", "Fun"], cover: "/img/club/typerace-2026.jpg", poster: "/img/posters/typerace.jpg", venue: "МУИС · 1-р байр 305",
      tagline: { mn: "Хурдан бичих тэмцээн", en: "A typing speed showdown" },
      description: { mn: "Гараараа хурдалж, кодын хэсгүүдийг хамгийн хурдан бичих бүх оюутны тэмцээн.", en: "An open contest to type code snippets the fastest." } },
  ];
  for (const d of LEGACY) {
    const abs = Date.UTC(d.ymd[0], d.ymd[1] - 1, d.ymd[2], 10) - UB_OFFSET;
    const start = Math.min(abs, nowMs - 30 * DAY);
    const mode = d.mode ?? "offline";
    mkEvent({
      slug: d.slug, kind: d.kind, title: { mn: d.title, en: d.title }, tagline: d.tagline, description: d.description,
      starts_at: iso(start), ends_at: iso(start + d.days * DAY - 2 * HOUR), status: "archived", approximate_date: d.approx, mode,
      venue_name: d.venue, venue_address: mode === "online" ? null : "Улаанбаатар хот", themes: d.themes, legacy_participants: d.participants,
      cover_path: d.cover, poster_path: d.poster, created_at: iso(start - 30 * DAY), created_by: null, external_url: null,
    });
  }

  const regOpens = nowMs - 50 * DAY;
  const kdStart = ubAt(4, 18, 30);
  const knowledgeDay = mkEvent({
    slug: "knowledge-day-rag", kind: "knowledge_day", status: "published",
    title: { mn: "Мэдлэгийн өдөр: RAG систем бүтээе", en: "Knowledge Day: Building RAG Systems" },
    tagline: { mn: "Вектор сан, хайлт, үнэлгээ — нэг орой дотор", en: "Vector stores, retrieval and evaluation in one evening" },
    description: { mn: "RAG (Retrieval-Augmented Generation) системийг гараас нь бүтээх практик семинар. Хэсэглэлт, хосолмол хайлт, дахин эрэмбэлэлт, үнэлгээний хэмжүүрүүдийг жишээгээр авч үзнэ.", en: "A hands-on seminar on building Retrieval-Augmented Generation from scratch: chunking, hybrid retrieval, reranking and evaluation metrics, with live examples." },
    starts_at: iso(kdStart), ends_at: iso(kdStart + 2 * HOUR), mode: "offline", venue_name: "МУИС · 1-р байр 305", venue_address: "Бага тойруу, Сүхбаатар дүүрэг, Улаанбаатар",
    audience: "open", reg_mode: "rsvp", capacity: 60, waitlist: true, reg_opens_at: iso(regOpens), themes: ["RAG", "LLM", "Search"],
    cover_path: "/img/posters/knowledge-day-05.jpg", poster_path: "/img/posters/knowledge-day-ml.jpg", ics_sequence: 1, created_at: iso(regOpens - 3 * DAY),
  });
  const anStart = ubAt(11, 19, 0);
  const alumniNight = mkEvent({
    slug: "alumni-night", kind: "meetup", status: "published",
    title: { mn: "Төгсөгчдийн үдэш", en: "Alumni Night" },
    tagline: { mn: "Хуучин найзууд, шинэ санаанууд", en: "Old friends, new ideas" },
    description: { mn: "Hackum-ийн төгсөгчид болон одоогийн гишүүд нэг дор уулзаж, туршлагаа хуваалцах, танилцах үдэш.", en: "An evening where Hackum alumni and current members meet, swap stories and make new connections." },
    starts_at: iso(anStart), ends_at: iso(anStart + 3 * HOUR), venue_name: "Нийслэл кафе · 2-р давхар", venue_address: "Чингисийн өргөн чөлөө, Улаанбаатар",
    audience: "open", capacity: null, reg_opens_at: iso(regOpens), themes: ["Networking", "Alumni"],
    cover_path: "/img/posters/meetup-3.jpg", poster_path: "/img/posters/meetup-2.jpg", created_at: iso(regOpens - 3 * DAY),
  });
  const cbStart = ubAt(30, 10, 0);
  const cBattle = mkEvent({
    slug: "c-battle-winter", kind: "competition", status: "draft",
    title: { mn: "C Battle: Өвлийн дугуй", en: "" },
    tagline: { mn: "Хурдан, зөв, цэвэр C код", en: "" },
    description: { mn: "C хэлний бодлого бодох өвлийн тэмцээн. Дүрэм, шагналын сан удахгүй зарлагдана.", en: "" },
    starts_at: iso(cbStart), ends_at: iso(cbStart + 8 * HOUR), venue_name: "МУИС · Компьютерийн лаборатори", venue_address: null,
    audience: "open", school_scope: "num", capacity: 40, reg_mode: "rsvp", themes: ["C", "Algorithms"], cover_path: null, poster_path: null, created_at: iso(nowMs - 5 * DAY),
  });
  const dhStart = ubAt(75, 9, 0);
  const experienceOptions: L[] = [
    { mn: "Анхан шат", en: "Beginner" }, { mn: "Дунд шат", en: "Intermediate" }, { mn: "Ахисан түвшин", en: "Advanced" },
  ];
  const devhackQuestions: Question[] = [
    { id: "skills", type: "short", label: { mn: "Таны гол ур чадвар", en: "Your main skills" }, required: true },
    { id: "experience", type: "select", label: { mn: "Хакатоны туршлага", en: "Hackathon experience" }, required: true, options: experienceOptions },
    { id: "github", type: "url", label: { mn: "GitHub эсвэл портфолио холбоос", en: "GitHub or portfolio link" }, required: false },
  ];
  const devhack = mkEvent({
    slug: "devhack-2027", kind: "hackathon", status: "published",
    title: { mn: "DevHack 2027", en: "DevHack 2027" },
    tagline: { mn: "48 цагийн дотор бүтээгдэхүүн хийе", en: "Ship a product in 48 hours" },
    description: { mn: "Хоёр өдрийн хакатон. 2–4 хүний багаар өрсөлдөж, менторуудын тусламжтайгаар бодит бүтээгдэхүүний прототип хийнэ. Бүртгэл анкетаар, сонгон шалгаруулалттай.", en: "A two-day hackathon. Teams of 2–4 build real product prototypes with mentor support. Registration is by application with a selection round." },
    starts_at: iso(dhStart), ends_at: iso(dhStart + 2 * DAY), venue_name: "МУИС · Спорт цогцолбор", venue_address: "Их сургуулийн гудамж, Улаанбаатар",
    audience: "open", reg_mode: "application", capacity: 120, waitlist: true, reg_opens_at: iso(regOpens), reg_closes_at: iso(dhStart - 30 * DAY),
    decision_deadline: iso(dhStart - 14 * DAY), team_mode: "optional", team_size_min: 2, team_size_max: 4, questions: devhackQuestions,
    themes: ["Hackathon", "Product", "AI"], cover_path: "/img/posters/registration-32h.jpg", poster_path: "/img/posters/pitch-night.jpg", created_at: iso(regOpens - 3 * DAY),
  });
  const liveStart = nowMs - HOUR;
  const membersMeetup = mkEvent({
    slug: "members-meetup-live", kind: "meetup", status: "published",
    title: { mn: "Гишүүдийн долоо хоногийн уулзалт", en: "Weekly Members Meetup" },
    tagline: { mn: "Төслүүдийн явц, шинэ санаа, пицца", en: "Project updates, new ideas and pizza" },
    description: { mn: "Гишүүд долоо хоногийн ажлаа танилцуулж, дараагийн арга хэмжээнүүдийг хамтдаа төлөвлөнө.", en: "Members present their weekly progress and plan upcoming events together." },
    starts_at: iso(liveStart), ends_at: iso(nowMs + 2 * HOUR), venue_name: "Hackum өрөө · МУИС 2-р байр 114", venue_address: null,
    audience: "members", school_scope: "num", capacity: 40, reg_opens_at: iso(regOpens), themes: ["Community"],
    cover_path: "/img/posters/meetup-1.jpg", poster_path: "/img/posters/meetup-arch.jpg", created_at: iso(regOpens - 3 * DAY),
  });
  const gitStart = ubAt(6, 20, 0);
  const gitOpens = nowMs - 14 * DAY;
  const gitWorkshop = mkEvent({
    slug: "online-workshop-git", kind: "workshop", status: "published", mode: "online", online_url: "https://meet.example.com/hackum-git",
    title: { mn: "Онлайн workshop: Git-ийн практик", en: "Online Workshop: Practical Git" },
    tagline: { mn: "Branch, rebase, pull request — андуурахгүйгээр", en: "Branches, rebase and pull requests without the panic" },
    description: { mn: "Багаар ажиллахад хэрэгтэй Git-ийн үндсэн урсгал: branch, merge, rebase, конфликт шийдэх, pull request.", en: "The Git workflow every team needs: branching, merging, rebasing, resolving conflicts and pull requests." },
    starts_at: iso(gitStart), ends_at: iso(gitStart + 90 * MIN), audience: "members", reg_mode: "rsvp", capacity: null, reg_opens_at: iso(gitOpens),
    themes: ["Git", "Tooling"], cover_path: "/img/posters/git-workshop.jpg", poster_path: "/img/posters/git-workshop.jpg", created_at: iso(gitOpens - 3 * DAY),
  });

  // ---- registrations & teams -----------------------------------------------------------------------------------
  const regDrafts = new Map<string, Omit<Registration, "id">[]>();
  const draft = (event: EventRow, p: Profile, status: RegStatus, o: Partial<Omit<Registration, "id" | "event_id" | "profile_id" | "status">> = {}) => {
    const lo = Math.max(event.reg_opens_at ? Date.parse(event.reg_opens_at) : 0, nowMs - 55 * DAY);
    const hi = Math.min(nowMs - 30 * MIN, Date.parse(event.starts_at) - 10 * MIN);
    const created = between(lo, hi);
    const cancelledAt = status === "cancelled" ? sec(Math.min(created + rng() * 5 * DAY, nowMs - 10 * MIN)) : null;
    const row: Omit<Registration, "id"> = {
      event_id: event.id, profile_id: p.id, status, source: chance(0.1) ? "admin" : "web", answers: {}, team_id: null,
      decided_by: null, decided_at: null, decision_notified_at: null, created_at: iso(created),
      cancelled_at: cancelledAt === null ? null : iso(cancelledAt), ...o,
    };
    const list = regDrafts.get(event.id) ?? [];
    list.push(row);
    regDrafts.set(event.id, list);
  };
  const group = (pool: readonly Profile[], n: number, forced: readonly Profile[] = []) => {
    const rest = shuffle(pool.filter((p) => !forced.includes(p)));
    return [...forced, ...rest].slice(0, n);
  };

  // a) knowledge day: 52 going + 2 cancelled
  const kdGroup = group(claimedPool, 54, [anuujin, temuulen]);
  kdGroup.forEach((p, i) => draft(knowledgeDay, p, i < 52 ? "going" : "cancelled"));

  // b) alumni night: 20 claimed alumni + 3 members
  const claimedAlumni = [saraa, ...alumni];
  const anGroup = [...claimedAlumni, ...group(members.filter((m) => m !== orgExtra), 3)];
  anGroup.forEach((p) => draft(alumniNight, p, "going"));

  // e) members meetup: 31 of the members
  const memberPool = claimedPool.filter((p) => p.status === "member");
  group(memberPool, 31, [anuujin]).forEach((p) => draft(membersMeetup, p, "going"));

  // f) git workshop: 18 members/alumni
  group(claimedPool.filter((p) => p.status !== "guest"), 18, [anuujin]).forEach((p) => draft(gitWorkshop, p, "going"));

  // d) devhack: 64 applied (58 in 15 teams + 6 solo) + 3 decided (a going pair, one rejected)
  const dhPeople = group(claimedPool, 67, [anuujin]);
  const appliedPeople = dhPeople.slice(0, 64);
  const [decidedA, decidedB, decidedRejected] = [at(dhPeople, 64), at(dhPeople, 65), at(dhPeople, 66)];
  const teamSizes = [...Array<number>(13).fill(4), 3, 3];
  const usedCodes = new Set<string>();
  const inviteCode = () => {
    for (;;) {
      const code = `HK-${Array.from({ length: 4 }, () => INVITE_ALPHABET[int(0, INVITE_ALPHABET.length - 1)]).join("")}`;
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
  };
  const teams: Team[] = [];
  const mkTeam = (name: string, captain: Profile, size: number, lockedPref: boolean): Team => {
    const t: Team = {
      id: nid("t"), event_id: devhack.id, name, invite_code: inviteCode(), captain_profile_id: captain.id,
      looking_for: size < 4 ? shuffle(LOOKING_FOR).slice(0, int(1, 2)) : [], locked: lockedPref || (size === 4 && chance(0.4)),
    };
    teams.push(t);
    return t;
  };
  const devAnswers = (p: Profile): Answers => {
    const a: Answers = { skills: pick(SKILLS), experience: String(int(0, 2)) };
    if (chance(0.6)) a.github = `https://github.example.com/${p.handle}`;
    return a;
  };
  let cursor = 0;
  teamSizes.forEach((size, i) => {
    const mates = appliedPeople.slice(cursor, cursor + size);
    cursor += size;
    const team = mkTeam(at(TEAM_LABELS, i), at(mates, 0), size, false);
    for (const p of mates) draft(devhack, p, "applied", { team_id: team.id, answers: devAnswers(p) });
  });
  for (const p of appliedPeople.slice(cursor)) draft(devhack, p, "applied", { answers: devAnswers(p) });
  const decisionAt = iso(sec(nowMs - 2 * DAY - int(0, 20) * HOUR));
  const goingTeam = mkTeam(at(TEAM_LABELS, 15), decidedA, 2, true);
  goingTeam.looking_for = [];
  const decided = { decided_by: organizer.id, decided_at: decisionAt, decision_notified_at: null };
  draft(devhack, decidedA, "going", { team_id: goingTeam.id, answers: devAnswers(decidedA), ...decided });
  draft(devhack, decidedB, "going", { team_id: goingTeam.id, answers: devAnswers(decidedB), ...decided });
  draft(devhack, decidedRejected, "rejected", { answers: devAnswers(decidedRejected), ...decided });

  const registrations: Registration[] = [];
  const eventsInOrder = [knowledgeDay, alumniNight, cBattle, devhack, membersMeetup, gitWorkshop];
  for (const e of eventsInOrder) {
    const rows = [...(regDrafts.get(e.id) ?? [])].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    for (const r of rows) registrations.push({ id: nid("r"), ...r });
  }
  const regsOf = (e: EventRow, status: RegStatus) => registrations.filter((r) => r.event_id === e.id && r.status === status);

  // ---- membership applications ---------------------------------------------------------------------------------
  type AppDraft = Omit<MembershipApplication, "id">;
  const appDrafts: AppDraft[] = [];
  const teamInterest = () => shuffle(TEAM_NAMES).slice(0, int(1, 2));
  const mkApp = (p: Profile, status: AppDraft["status"], note: string | null): AppDraft => {
    const reviewed = status !== "pending";
    const created = reviewed ? between(nowMs - 13 * DAY, nowMs - 4 * DAY) : between(nowMs - 12 * DAY, nowMs - HOUR);
    const row: AppDraft = {
      profile_id: p.id, season: 2027, motivation: pick(MOTIVATIONS), team_interest: teamInterest(), answers: {}, status,
      reviewed_by: reviewed ? organizer.id : null,
      reviewed_at: reviewed ? iso(sec(Math.min(created + (1 + rng() * 2) * DAY, nowMs - 2 * HOUR))) : null,
      review_note: note, created_at: iso(created),
    };
    appDrafts.push(row);
    return row;
  };
  const approvalNotes = ["Туршлага сайн, Dev багт нэгдүүлэв.", "Идэвхтэй оролцогч, Events багт тохирно.", "Дизайны портфолио сайн, Design багт авав."];
  guests.slice(0, 7).forEach((p) => mkApp(p, "pending", null));
  approvedApplicants.forEach((p, i) => mkApp(p, "approved", at(approvalNotes, i)));
  mkApp(at(guests, 7), "rejected", "Одоогоор квот дүүрсэн тул дараагийн улиралд дахин хүсэлт гаргана уу.");
  const membership_applications: MembershipApplication[] = appDrafts
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map((a) => ({ id: nid("a"), ...a }));
  for (const a of membership_applications.filter((x) => x.status === "approved")) {
    memberships.push({ profile_id: a.profile_id, season: 2027, team: at(a.team_interest, 0), role_title: null });
  }

  // ---- subscribers ---------------------------------------------------------------------------------------------
  const subscribers: Subscriber[] = [];
  const subEmails = new Set<string>();
  const subAgo = Array.from({ length: 25 }, () => int(2, 420)).sort((a, b) => b - a);
  subAgo.forEach((days, i) => {
    const given = pick(GIVEN);
    const fam = pick(FAMILY);
    let local = kebab(`${given[1]}.${fam[1]}`).replace(/-/g, ".");
    if (subEmails.has(`${local}@example.org`)) local = `${local}${i}`;
    const email = `${local}@example.org`;
    subEmails.add(email);
    subscribers.push({ email, name: `${given[1]} ${fam[1]}`, lang: chance(0.7) ? "mn" : "en", source: pick(["footer", "join_page", "event_page"]), created_at: iso(sec(nowMs - days * DAY)) });
  });

  // ---- notifications -------------------------------------------------------------------------------------------
  const notifications: Notification[] = [];
  const priorityOf = (t: TemplateName): 0 | 1 | 2 => (t === "announcement" ? 2 : t === "reminder_24h" ? 1 : 0);
  const notif = (o: {
    to: { profile: Profile } | { email: string }; template: TemplateName; status: Notification["status"]; scheduled: number; dedupe: string;
    payload?: Notification["payload"]; attempts?: number; error?: string | null;
  }) => {
    const sent = o.status === "sent";
    notifications.push({
      id: nid("n"),
      profile_id: "profile" in o.to ? o.to.profile.id : null,
      to_email: "email" in o.to ? o.to.email : null,
      channel: "email", template: o.template, payload: o.payload ?? {}, priority: priorityOf(o.template),
      scheduled_at: iso(o.scheduled), status: o.status, attempts: o.attempts ?? (sent ? 1 : 0), last_error: o.error ?? null,
      dedupe_key: o.dedupe, sent_at: sent ? iso(Math.min(o.scheduled + MIN, nowMs - MIN)) : null,
    });
  };
  const kdGoing = regsOf(knowledgeDay, "going");
  const kdPayload = (p: Profile) => ({ event_slug: knowledgeDay.slug, locale: p.locale });
  const regProfile = (r: Registration) => {
    const p = byId.get(r.profile_id);
    if (!p) throw new Error("seed: registration without profile");
    return p;
  };
  // sent (31)
  [anuujin, temuulen, ...guests.slice(0, 4)].forEach((p) => {
    notif({ to: { profile: p }, template: "welcome", status: "sent", scheduled: Date.parse(p.onboarded_at ?? p.created_at), dedupe: `welcome:${p.id}`, payload: { locale: p.locale } });
  });
  kdGoing.slice(0, 12).forEach((r) => {
    const p = regProfile(r);
    notif({ to: { profile: p }, template: "rsvp_confirmed", status: "sent", scheduled: Date.parse(r.created_at), dedupe: `rsvp:${r.event_id}:${r.profile_id}`, payload: kdPayload(p) });
  });
  regsOf(devhack, "applied").slice(0, 6).forEach((r) => {
    notif({ to: { profile: regProfile(r) }, template: "application_received", status: "sent", scheduled: Date.parse(r.created_at), dedupe: `app_received:${r.event_id}:${r.profile_id}`, payload: { event_slug: devhack.slug } });
  });
  for (const a of membership_applications.filter((x) => x.status !== "pending")) {
    const template: TemplateName = a.status === "approved" ? "membership_approved" : "membership_rejected";
    const p = byId.get(a.profile_id);
    if (!p) throw new Error("seed: application without profile");
    notif({ to: { profile: p }, template, status: "sent", scheduled: Date.parse(a.reviewed_at ?? a.created_at), dedupe: `${template}:${a.id}`, payload: { season: a.season } });
  }
  subscribers.slice(0, 3).forEach((s) => {
    notif({ to: { email: s.email }, template: "welcome", status: "sent", scheduled: Date.parse(s.created_at), dedupe: `welcome:subscriber:${s.email}`, payload: { locale: s.lang } });
  });
  // failed (3)
  const failedErrors = ["mailbox_unavailable", "smtp_timeout"];
  kdGoing.slice(12, 14).forEach((r, i) => {
    notif({ to: { profile: regProfile(r) }, template: "rsvp_confirmed", status: "failed", scheduled: Date.parse(r.created_at), dedupe: `rsvp:${r.event_id}:${r.profile_id}`, attempts: 5, error: at(failedErrors, i), payload: { event_slug: knowledgeDay.slug } });
  });
  notif({ to: { email: "bounced.user@example.com" }, template: "welcome", status: "failed", scheduled: nowMs - 9 * DAY, dedupe: "welcome:subscriber:bounced.user@example.com", attempts: 5, error: "mailbox_unavailable" });
  // queued (4): 24 h reminders for the knowledge day
  kdGoing.slice(14, 18).forEach((r) => {
    notif({ to: { profile: regProfile(r) }, template: "reminder_24h", status: "queued", scheduled: kdStart - 24 * HOUR, dedupe: `reminder24:${r.event_id}:${r.profile_id}:${knowledgeDay.starts_at}`, payload: { event_slug: knowledgeDay.slug } });
  });
  // skipped (2)
  const optedOut = profiles.find((p) => p.clerk_user_id && !p.notif_prefs.announcements);
  if (!optedOut) throw new Error("seed: expected a profile with announcements off");
  notif({ to: { profile: optedOut }, template: "announcement", status: "skipped", scheduled: nowMs - 2 * DAY, dedupe: `announcement:promo-knowledge-day:${optedOut.id}`, error: "prefs_disabled", payload: { campaign: "knowledge-day-promo" } });
  notif({ to: { email: "complaint@example.org" }, template: "welcome", status: "skipped", scheduled: nowMs - 21 * DAY, dedupe: "welcome:subscriber:complaint@example.org", error: "suppressed" });

  const email_daily_usage: Record<string, number> = {};
  for (let d = 6; d >= 1; d--) email_daily_usage[ubDayKey(d)] = int(8, 32);
  email_daily_usage[ubDayKey(0)] = 37;
  const email_suppressions = [
    { email: "bounced.user@example.com", reason: "bounce", at: iso(sec(nowMs - 9 * DAY)) },
    { email: "complaint@example.org", reason: "complaint", at: iso(sec(nowMs - 21 * DAY)) },
  ];

  // ---- timeline ------------------------------------------------------------------------------------------------
  type MilestoneDef = [year: number, title: L, note: L | null, front: string | null, back: string | null];
  const MILESTONES: MilestoneDef[] = [
    [2017, { mn: "Hackum үүссэн", en: "Hackum is founded" }, { mn: "МУИС-ийн хэдэн оюутан програмчлалын клуб байгуулав.", en: "A handful of NUM students start a programming club." }, "/img/club/manul.jpg", null],
    [2017, { mn: "Анхны уулзалт", en: "First meetup" }, { mn: "12 гишүүнтэй анхны нээлттэй уулзалт.", en: "The first open meetup with 12 members." }, null, null],
    [2018, { mn: "Hackathon 2018", en: "Hackathon 2018" }, { mn: "Анхны том хакатон: 120 оролцогч.", en: "The first big hackathon: 120 participants." }, "/img/club/hackathon-2018.jpg", null],
    [2018, { mn: "Манул сахиус", en: "The Manul mascot" }, { mn: "Клубийн сахиус Мануул төрсөн.", en: "The club mascot, Manul, is born." }, "/img/club/manul.jpg", null],
    [2019, { mn: "OpenData Hackathon 2019", en: "OpenData Hackathon 2019" }, { mn: "Нээлттэй өгөгдлөөр нийгмийн асуудал шийдсэн.", en: "Civic problems solved with open data." }, "/img/club/opendata-2019.jpg", null],
    [2019, { mn: "Digital Hackathon 2019", en: "Digital Hackathon 2019" }, { mn: "150 оролцогчтой хоёр өдрийн хакатон.", en: "A two-day hackathon with 150 participants." }, "/img/club/digital-2019.jpg", null],
    [2020, { mn: "Online Hackathon 2020", en: "Online Hackathon 2020" }, { mn: "Анхны онлайн хакатон: 200 оролцогч.", en: "The first online hackathon: 200 participants." }, "/img/posters/online-hackathon-2020.jpg", null],
    [2020, { mn: "Онлайн workshop-ийн улирал", en: "A season of online workshops" }, { mn: "Карантины үед долоо хоног бүр онлайн хичээл.", en: "Weekly online workshops throughout lockdown." }, null, null],
    [2021, { mn: "Тал нутгийн аялал", en: "Steppe outing" }, { mn: "Клубийн гишүүд хамтдаа тал нутагт амарсан.", en: "Club members head to the steppe together." }, "/img/club/outing-steppe-2021.jpg", "/img/club/outing-forest.jpg"],
    [2021, { mn: "Мэдлэгийн өдөр", en: "Knowledge Day begins" }, { mn: "Сар бүрийн мэдлэг хуваалцах өдөр эхэлсэн.", en: "A monthly knowledge-sharing day is launched." }, null, null],
    [2022, { mn: "Startup Pitch Night", en: "Startup Pitch Night" }, { mn: "Гишүүдийн стартап санаа хөрөнгө оруулагчдад танилцуулагдсан.", en: "Members pitch startup ideas to investors." }, "/img/club/startup-5.jpg", null],
    [2023, { mn: "Digital NUM Appathon 2023", en: "Digital NUM Appathon 2023" }, { mn: "Оюутны амьдралд зориулсан апп бүтээсэн.", en: "Apps built for student life." }, "/img/club/appathon-2023.jpg", null],
    [2024, { mn: "XacBank Hackathon 2024", en: "XacBank Hackathon 2024" }, { mn: "36 баг банк санхүүгийн кейс дээр өрсөлдсөн.", en: "36 teams competed on banking cases." }, "/img/club/xac-2024.jpg", "/img/club/digitalnum-2024.jpg"],
    [2025, { mn: "C Battle 2025", en: "C Battle 2025" }, { mn: "C хэлний анхны тэмцээн.", en: "The first C programming contest." }, "/img/club/cbattle-2025.jpg", null],
    [2025, { mn: "Жилийн их цуглаан", en: "Annual gathering" }, { mn: "Гишүүд, төгсөгчид нэг тайзан дээр цугларсан.", en: "Members and alumni on one stage." }, "/img/club/stage-2025.jpg", null],
    [2026, { mn: "Typerace 2026", en: "Typerace 2026" }, { mn: "Хурдан бичих тэмцээн.", en: "A typing speed showdown." }, "/img/club/typerace-2026.jpg", null],
  ];
  const timeline_milestones: Milestone[] = MILESTONES.map(([year, title, note, front, back], i) => ({
    id: nid("m"), year, title, note, url: null, front_path: front, back_path: back, sort: (i + 1) * 10,
  }));

  // ---- audit log -----------------------------------------------------------------------------------------------
  type AuditDraft = Omit<AuditEntry, "id">;
  const auditDrafts: AuditDraft[] = [];
  const audit = (actor: Profile, action: string, entity: string, entity_id: string, diff: Record<string, unknown>, atMs: number) =>
    auditDrafts.push({ actor_profile_id: actor.id, action, entity, entity_id, diff, at: iso(Math.min(atMs, nowMs - MIN)) });
  audit(admin, "staff.grant", "staff_role", organizer.id, { role: [null, "organizer"] }, nowMs - 249 * DAY);
  audit(admin, "staff.grant", "staff_role", orgExtra.id, { role: [null, "organizer"] }, nowMs - 120 * DAY);
  audit(admin, "season.update", "season", "2027", { application_opens_at: [null, iso(nowMs - 14 * DAY)] }, nowMs - 15 * DAY);
  audit(admin, "season.update", "season", "2027", { application_closes_at: [null, iso(nowMs + 35 * DAY)] }, nowMs - 15 * DAY + HOUR);
  for (const e of eventsInOrder) {
    const created = Date.parse(e.created_at);
    audit(organizer, "event.create", "event", e.id, { slug: e.slug, status: "draft" }, created);
    if (e.status === "published") audit(organizer, "event.publish", "event", e.id, { status: ["draft", "published"] }, created + DAY);
  }
  audit(organizer, "event.update", "event", knowledgeDay.id, { capacity: [50, 60] }, nowMs - 20 * DAY);
  audit(orgExtra, "event.update", "event", knowledgeDay.id, { venue_name: ["МУИС · 1-р байр 204", "МУИС · 1-р байр 305"], ics_sequence: [0, 1] }, nowMs - 18 * DAY);
  audit(organizer, "event.update", "event", devhack.id, { team_size_max: [5, 4] }, nowMs - 25 * DAY);
  audit(orgExtra, "event.update", "event", alumniNight.id, { starts_at: [iso(anStart - DAY), iso(anStart)] }, nowMs - 12 * DAY);
  audit(organizer, "event.update", "event", cBattle.id, { "title.mn": ["C Battle", "C Battle: Өвлийн дугуй"] }, nowMs - 4 * DAY);
  audit(admin, "member.update", "profile", at(members, 1).id, { status: ["guest", "member"] }, nowMs - 35 * DAY);
  audit(admin, "member.update", "profile", saraa.id, { status: ["member", "alumni"] }, nowMs - 90 * DAY);
  for (const r of registrations.filter((x) => x.decided_at)) {
    audit(organizer, "registration.decide", "registration", r.id, { status: ["applied", r.status] }, Date.parse(r.decided_at ?? r.created_at));
  }
  for (const a of membership_applications.filter((x) => x.status !== "pending")) {
    audit(organizer, a.status === "approved" ? "membership.approve" : "membership.reject", "membership_application", a.id, { status: ["pending", a.status] }, Date.parse(a.reviewed_at ?? a.created_at));
  }
  const audit_log: AuditEntry[] = auditDrafts
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((a) => ({ id: nid("au"), ...a }));

  // In-app inbox: the latest sent mail of each demo persona (the two newest unread), and for staff the pending applications
  // and the mail that gave up.
  const inbox: InboxItem[] = [];
  const inboxId = () => nid("in");
  for (const who of [anuujin, temuulen, saraa]) {
    const sent = notifications.filter((n) => n.profile_id === who.id && n.status === "sent" && n.sent_at).sort((a, b) => b.sent_at!.localeCompare(a.sent_at!)).slice(0, 6);
    sent.forEach((n, i) => inbox.push({ id: inboxId(), profile_id: who.id, kind: n.template, payload: n.payload, created_at: n.sent_at!, read_at: i < 2 ? null : n.sent_at!, dedupe_key: n.dedupe_key }));
  }
  for (const a of membership_applications.filter((x) => x.status === "pending").slice(0, 3)) {
    const who = profiles.find((p) => p.id === a.profile_id);
    for (const r of staff_roles) inbox.push({ id: inboxId(), profile_id: r.profile_id, kind: "staff_application", payload: { application_id: a.id, profile_id: a.profile_id, name: who?.name.mn || who?.name.en || "" }, created_at: a.created_at, read_at: null, dedupe_key: `staffapp:${a.id}:${r.profile_id}` });
  }
  for (const n of notifications.filter((x) => x.status === "failed").slice(0, 2)) {
    for (const r of staff_roles) inbox.push({ id: inboxId(), profile_id: r.profile_id, kind: "staff_failed_email", payload: { notification_id: n.id, template: n.template }, created_at: n.scheduled_at, read_at: null, dedupe_key: `failed:${n.id}:${r.profile_id}` });
  }

  // Site forms staff can edit under Forms (all optional so the demo flows stay short).
  const sel = (id: string, mn: string, en: string, opts: [string, string][]): Question => ({ id, type: "select", required: false, label: { mn, en }, options: opts.map(([a, b]) => ({ mn: a, en: b })) });
  const forms: Form[] = [
    { id: "membership_application", kind: "membership_application", title: { mn: "Гишүүнчлэлийн өргөдөл", en: "Membership application" }, updated_at: iso(nowMs - 30 * DAY), updated_by: null, questions: [
      sel("experience", "Программчлалын туршлага", "Programming experience", [["Анхан шат", "Beginner"], ["Дунд", "Some projects"], ["Ахисан", "Advanced"]]),
      { id: "portfolio", type: "url", required: false, label: { mn: "GitHub эсвэл портфолио холбоос", en: "GitHub or portfolio link" } },
    ] },
    { id: "join", kind: "join", title: { mn: "Hackum-д нэгдэх", en: "Join Hackum" }, updated_at: iso(nowMs - 30 * DAY), updated_by: null, questions: [
      sel("how_heard", "Бидний тухай хаанаас мэдсэн бэ?", "How did you hear about us?", [["Найз", "A friend"], ["Сошиал", "Social media"], ["Арга хэмжээ", "An event"], ["Багш", "A teacher"], ["Бусад", "Other"]]),
      { id: "goal", type: "short", required: false, label: { mn: "Юу сурахыг хүсэж байна вэ?", en: "What do you want to learn?" } },
    ] },
  ];
  const form_submissions: FormSubmission[] = profiles.filter((p) => p.onboarded_at && !p.handle.startsWith("dev-")).slice(0, 14)
    .map((p, i) => ({ id: nid("fs"), form_id: "join" as const, profile_id: p.id, answers: { how_heard: String(i % 5), ...(i % 3 === 0 ? { goal: "Web ба AI" } : {}) }, created_at: p.created_at }));

  const profile_semesters: ProfileSemester[] = [
    { profile_id: anuujin.id, year: 2026, term: "autumn", subjects: ["Algorithms and data structures", "Databases", "Operating systems"], shared: true },
    { profile_id: anuujin.id, year: 2025, term: "spring", subjects: ["Discrete mathematics", "Object-oriented programming"], shared: false },
  ];

  const db: Db = {
    profiles, memberships, staff_roles, seasons,
    events,
    registrations, teams, membership_applications, notifications, email_daily_usage, email_suppressions, subscribers,
    timeline_milestones, audit_log, profile_semesters, auth_codes: [], inbox, forms, form_submissions, avatars: {}, seq: seq + 1,
  };
  addRecentPastEvents(db, nowMs);
  return db;
}

/**
 * Five recently completed events with real attendance, so badges, the "Past" tabs and new-vs-returning statistics have
 * data to show. Deterministic (no randomness): the member persona attends all five, the alumna the three oldest.
 */
function addRecentPastEvents(db: Db, nowMs: number) {
  const iso = (ms: number) => new Date(ms).toISOString();
  const defs = [
    { slug: "react-workshop-autumn", kind: "workshop" as const, daysAgo: 49, mn: "React workshop: хоёр цагт анхны апп", en: "React workshop: your first app in two hours", img: "react-workshop" },
    { slug: "cv-workshop-autumn", kind: "workshop" as const, daysAgo: 37, mn: "Компьютер хараа: зураг таних workshop", en: "Computer vision: image recognition workshop", img: "cv-workshop" },
    { slug: "css-battle-autumn", kind: "competition" as const, daysAgo: 24, mn: "CSS Battle · Намар", en: "CSS Battle · Autumn", img: "quiz" },
    { slug: "git-night-autumn", kind: "workshop" as const, daysAgo: 13, mn: "Git-ийн үдэш: баг дотор яаж ажиллах вэ", en: "Git night: how to work in a team", img: "git-workshop" },
    { slug: "pitch-night-autumn", kind: "meetup" as const, daysAgo: 5, mn: "Pitch Night · Намар", en: "Pitch Night · Autumn", img: "pitch-night" },
  ];
  const persona = (handle: string) => db.profiles.find((p) => p.handle === handle)?.id;
  const staff = new Set(db.staff_roles.map((r) => r.profile_id));
  const pool = db.profiles.filter((p) => p.clerk_user_id && p.onboarded_at && !p.deleted_at && !staff.has(p.id) && p.handle !== "new-guest" && p.handle !== "temuulen" && p.handle !== "bayar" && p.handle !== "anuujin" && p.handle !== "saraa");
  defs.forEach((d, i) => {
    const start = nowMs - d.daysAgo * DAY + 11 * HOUR; // 19:00 Ulaanbaatar
    const event: EventRow = {
      id: nextId(db, "e"), slug: d.slug, kind: d.kind, title: { mn: d.mn, en: d.en }, tagline: { mn: "", en: "" }, description: { mn: "", en: "" },
      starts_at: iso(start), ends_at: iso(start + 2 * HOUR), tz: "Asia/Ulaanbaatar", approximate_date: false, mode: "offline", venue_name: "МУИС · 1-р байр 305", venue_address: null,
      online_url: null, audience: "open", school_scope: "all", capacity: 60, waitlist: true, reg_opens_at: null, reg_closes_at: null, status: "completed",
      cover_path: `/img/posters/${d.img}.jpg`, poster_path: `/img/posters/${d.img}.jpg`, themes: [], external_url: null, legacy_participants: null, ics_sequence: 0,
      reg_mode: "rsvp", questions: [], team_mode: "none", team_size_min: 1, team_size_max: 1, decision_deadline: null, created_by: null, created_at: iso(start - 20 * DAY),
    };
    db.events.push(event);
    const attendees = new Set<string>();
    const anuujin = persona("anuujin"), saraa = persona("saraa");
    if (anuujin) attendees.add(anuujin);
    if (saraa && i < 3) attendees.add(saraa);
    pool.forEach((p, j) => { if ((j * 7 + i * 3) % 5 < 2) attendees.add(p.id); });
    for (const profileId of attendees) {
      db.registrations.push({
        id: nextId(db, "r"), event_id: event.id, profile_id: profileId, status: "attended", source: "web", answers: {}, team_id: null,
        decided_by: null, decided_at: null, decision_notified_at: null, created_at: iso(start - 3 * DAY), cancelled_at: null,
      });
    }
  });
  db.seq += 1; // keep the convention: seq = last id number used + 1
}
