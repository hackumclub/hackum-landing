import { POSTERS } from "./posters";

/**
 * Static stand-in for the @hackumclub feed shown in the phone preview (components/InstagramPreview).
 * To go live later, replace this list with posts from the Instagram Graph API (same shape: image + alt + permalink).
 */
export type IgPost = { src: string; alt: string; altEn: string; url: string };

const PROFILE = "https://www.instagram.com/hackumclub/";

export const IG_POSTS: IgPost[] = [
  POSTERS.typerace, POSTERS.tetris, POSTERS.trip, POSTERS.meetup3, POSTERS.recruit, POSTERS.register,
  POSTERS.cbattle, POSTERS.meetup2, POSTERS.cv, POSTERS.pitch, POSTERS.git, POSTERS.quiz,
  POSTERS.meetup1, POSTERS.react, POSTERS.kd05, POSTERS.kdML, POSTERS.meetupArch, POSTERS.online2020,
].map((p) => ({ src: p.src, alt: p.alt, altEn: p.altEn, url: PROFILE }));
