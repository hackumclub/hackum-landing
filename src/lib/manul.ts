// Мануул stickers exported from the Figma "manul" page (sticker-1 / sticker-2 sheets), backgrounds removed.
const S = "/img/manul";

export const STICKERS = {
  coffee: { src: `${S}/coffee.png`, w: 742, h: 676, alt: { mn: "Аяга кофе барьсан Мануул", en: "Manul holding a cup of coffee" } },
  grumpy: { src: `${S}/grumpy.png`, w: 684, h: 656, alt: { mn: "Гараа зангидсан Мануул", en: "Manul with crossed arms" } },
  laptop: { src: `${S}/laptop.png`, w: 760, h: 624, alt: { mn: "Зөөврийн компьютертэй Мануул", en: "Manul with a laptop" } },
  roll: { src: `${S}/roll.png`, w: 737, h: 529, alt: { mn: "Хөнтөрч хэвтсэн Мануул", en: "Manul rolling over" } },
  sleepy: { src: `${S}/sleepy.png`, w: 871, h: 520, alt: { mn: "Нойрмог Мануул", en: "Sleepy Manul" } },
  smug: { src: `${S}/smug.png`, w: 740, h: 687, alt: { mn: "Өөртөө итгэлтэй Мануул", en: "Smug Manul" } },
  toast: { src: `${S}/toast.png`, w: 769, h: 705, alt: { mn: "Талх идэж буй Мануул", en: "Manul eating toast" } },
  torch: { src: `${S}/torch.png`, w: 620, h: 679, alt: { mn: "Бамбар барьсан Мануул", en: "Manul holding a torch" } },
  wave: { src: `${S}/wave.png`, w: 608, h: 690, alt: { mn: "Гар даллаж буй Мануул", en: "Manul waving" } },
  yell: { src: `${S}/yell.png`, w: 596, h: 674, alt: { mn: "Баярлан хашгирч буй Мануул", en: "Manul cheering" } },
  build: { src: `${S}/build.png`, w: 1024, h: 1011, alt: { mn: "Каск өмсөж, түлхүүр барьсан Мануул", en: "Manul in a hard hat holding a wrench" } },
  checkin: { src: `${S}/checkin.png`, w: 1024, h: 973, alt: { mn: "Утсан дээрээ ногоон тэмдэг харуулж буй Мануул", en: "Manul showing a green check mark on a phone" } },
  comfort: { src: `${S}/comfort.png`, w: 806, h: 1024, alt: { mn: "Зүрх барьж тайвшруулж буй Мануул", en: "Manul offering a comforting heart" } },
  feedback: { src: `${S}/feedback.png`, w: 1002, h: 1024, alt: { mn: "Одтой самбар барьсан Мануул", en: "Manul holding a clipboard with a star" } },
  grad: { src: `${S}/grad.png`, w: 925, h: 1024, alt: { mn: "Төгсөгчийн малгайтай Мануул", en: "Manul in a graduation cap" } },
  lock: { src: `${S}/lock.png`, w: 1024, h: 987, alt: { mn: "Хаалга хамгаалж буй Мануул", en: "Manul guarding a closed gate" } },
  mail: { src: `${S}/mail.png`, w: 819, h: 1024, alt: { mn: "Дугтуй тэврэсэн Мануул", en: "Manul hugging an envelope" } },
  offline: { src: `${S}/offline.png`, w: 881, h: 1024, alt: { mn: "Утсанд ороолдсон, толгой эргэсэн Мануул", en: "Manul tangled in a cable" } },
  queue: { src: `${S}/queue.png`, w: 884, h: 1024, alt: { mn: "Дугаарын билет барьсан Мануул", en: "Manul holding a queue ticket" } },
  rsvp: { src: `${S}/rsvp.png`, w: 929, h: 1024, alt: { mn: "Баярын малгайтай Мануул", en: "Manul in a party hat" } },
  search: { src: `${S}/search.png`, w: 842, h: 1024, alt: { mn: "Томруулдаг шилээр ширтэж буй Мануул", en: "Manul peering through a magnifying glass" } },
  team: { src: `${S}/team.png`, w: 1024, h: 724, alt: { mn: "Хоёр Мануул гар ташиж буй", en: "Two Manuls high-fiving" } },
  trophy: { src: `${S}/trophy.png`, w: 725, h: 1024, alt: { mn: "Цом өргөсөн Мануул", en: "Manul lifting a trophy" } },
  writing: { src: `${S}/writing.png`, w: 916, h: 1024, alt: { mn: "Бичиж буй Мануул", en: "Manul writing" } },
} as const;

export type StickerName = keyof typeof STICKERS;

// One Мануул per event, picked to match the event's mood.
export const EVENT_STICKER: Record<string, StickerName> = {
  "typerace-2026": "laptop",
  "dev-hackathon-2025": "coffee",
  "c-battle-2025": "torch",
  "xacbank-hackathon-2024": "smug",
  "digital-num-appathon-2023": "wave",
  "num-startup-3-2023": "yell",
  "hackum-online-hackathon-2020": "sleepy",
  "num-open-data-hackathon-2019": "grumpy",
};
export const stickerFor = (slug: string): StickerName => EVENT_STICKER[slug] ?? "smug";
