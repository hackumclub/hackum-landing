import { CLUB } from "./club";

export const SITE = { name: CLUB.short, tagline: CLUB.name };
export const NAV = [
  { href: "/hackathons", label: "Эвентүүд" },
  { href: "/about", label: "Бидний тухай" },
] as const;
export const FOOTER = {
  Club: [["Бидний тухай", "/about"], ["Эвентүүд", "/hackathons"], ["Клубт нэгдэх", "/organize"], ["Code of Conduct", "/code-of-conduct"]],
  Social: CLUB.socials,
} as const;
