// Poster helpers. Until real uploads exist (Supabase Storage), covers are files under /public/img/posters.

/** A path we are willing to hand to next/image: a local image file, no traversal, no scheme. */
const SAFE = /^\/[\w][\w./-]*\.(?:jpe?g|png|webp|avif|gif)$/i;

export function posterSrc(path: string | null | undefined): string | null {
  const p = (path ?? "").trim();
  return SAFE.test(p) && !p.includes("..") && !p.includes("//") ? p : null;
}

/** The poster library shown in the form: every file the seed ships, alphabetical. */
export const POSTER_LIBRARY = [
  "cbattle", "cv-workshop", "git-workshop", "knowledge-day-05", "knowledge-day-ml", "meetup-1", "meetup-2", "meetup-3", "meetup-arch",
  "online-hackathon-2020", "pitch-night", "quiz", "react-workshop", "recruit-honey", "registration-32h", "selenge-trip", "tetris", "typerace",
].map((id) => ({ id, path: `/img/posters/${id}.jpg`, name: id.replace(/-/g, " ") }));
