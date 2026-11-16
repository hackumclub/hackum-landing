import type { L } from "@/i18n/config";
import type { StickerName } from "@/lib/manul";

export type Slide = { title: L; body: L; sticker: StickerName };

/** The three panels of the presentation beside the sign-in and join forms. */
export const SLIDES: Slide[] = [
  {
    title: { mn: "Оюутнуудаар бүтсэн, оюутнуудад зориулсан", en: "Built by students, for students" },
    body: { mn: "2017 оноос хойш МУИС-ийн оюутнууд хакатон, workshop, Мэдлэгийн өдрийг өөрсдөө зохион байгуулж ирлээ.", en: "Since 2017, students at NUM have run the hackathons, workshops and Knowledge Days themselves." },
    sticker: "laptop",
  },
  {
    title: { mn: "Суудал чинь нэг товшилтын цаана", en: "Your seat is one tap away" },
    body: { mn: "Эвентэд бүртгүүл, багаараа хакатонд өргөдөл өг, сануулгаа цагт нь аваарай.", en: "RSVP to events, apply to hackathons with your team and get reminders on time." },
    sticker: "rsvp",
  },
  {
    title: { mn: "Улирал бүр гишүүн болох боломж", en: "Become a member every season" },
    body: { mn: "МУИС-ийн оюутнууд өргөдөл өгч, тэмдэг цуглуулж, баг болон түүхээ хадгална.", en: "NUM students can apply, collect badges and keep their teams and history." },
    sticker: "trophy",
  },
];
export const SLIDE_MS = 6000;
