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
