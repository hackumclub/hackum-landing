// Club posters exported from the "hackum-club" Figma file (rendered frames, not raw photos).
const P = "/img/posters";

export type Poster = { src: string; alt: string; altEn: string; w: number; h: number };

const EN: Record<string, string> = {
  "meetup-1": "Tech Meetup #1 poster: Ts. Shikhikhutug, Senior Software Engineer",
  "meetup-2": "Tech Meetup #2 poster: B. Odbayar, Digital Solution Manager",
  "meetup-3": "Tech Meetup #3 poster: B. Batjargal, start-up advice",
  "meetup-arch": "Tech Meetup poster",
  "react-workshop": "React Workshop poster: M. Naranbat",
  "git-workshop": "Workshop #1 poster: Git & Terminal",
  "cv-workshop": "CV Workshop poster: crafting paths one page at a time",
  "pitch-night": "Pitch Night poster: share your idea, light up the room",
  "quiz": "Hackum Quiz poster",
  "cbattle": "C Battle 2025 poster",
  "typerace": "Typerace 2026 speed-typing championship poster",
  "tetris": "Tetris Champ contest poster",
  "selenge-trip": "Selenge trip poster",
  "recruit-honey": "Recruitment is open poster",
  "registration-32h": "Registration opens in 32 hours poster",
  "online-hackathon-2020": "Hackum Online Hackathon 2020 poster: against COVID-19",
  "knowledge-day-ml": "Knowledge Day poster: machine learning with Python",
  "knowledge-day-05": "Knowledge Day 05 poster: tech roadmap",
};

const poster = (file: string, alt: string, w: number, h: number): Poster => ({ src: `${P}/${file}.jpg`, alt, altEn: EN[file] ?? alt, w, h });

export const POSTERS = {
  meetup1: poster("meetup-1", "Tech Meetup #1 постер: Ц. Шихихутуг, Senior Software Engineer", 1100, 1100),
  meetup2: poster("meetup-2", "Tech Meetup #2 постер: Б. Одбаяр, Digital Solution Manager", 1100, 1100),
  meetup3: poster("meetup-3", "Tech Meetup #3 постер: Б. Батжаргал, Start-up advice", 1030, 1100),
  meetupArch: poster("meetup-arch", "Tech Meetup постер", 880, 1100),
  react: poster("react-workshop", "React Workshop постер: М. Наранбат", 1100, 1100),
  git: poster("git-workshop", "Workshop #1 постер: Git & Terminal", 880, 1100),
  cv: poster("cv-workshop", "CV Workshop постер: Crafting paths one page at a time", 825, 1100),
  pitch: poster("pitch-night", "Pitch Night постер: Share your idea. Light up the room.", 880, 1100),
  quiz: poster("quiz", "Hackum Quiz постер", 619, 1100),
  cbattle: poster("cbattle", "C Battle 2025 постер", 880, 1100),
  typerace: poster("typerace", "Хурдан бичилтийн аварга шалгаруулах тэмцээн 2026 постер", 880, 1100),
  tetris: poster("tetris", "Tetris Champ тэмцээний постер", 778, 1100),
  trip: poster("selenge-trip", "Сэлэнгэ аялал постер", 1100, 1100),
  recruit: poster("recruit-honey", "Элсэлт эхэллээ постер", 1100, 1100),
  register: poster("registration-32h", "Бүртгэл эхлэхэд 32 цаг үлдлээ постер", 1100, 1100),
  online2020: poster("online-hackathon-2020", "Hackum Online Hackathon 2020 постер: COVID-19-ийн эсрэг", 1100, 1100),
  kdML: poster("knowledge-day-ml", "Knowledge Day постер: Machine learning with python", 1100, 1100),
  kd05: poster("knowledge-day-05", "Knowledge Day 05 постер: Tech Roadmap", 1100, 1100),
} as const;
