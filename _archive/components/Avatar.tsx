const C = { brand: "#3770ff", sand: "#eeb27b", teal: "#58d1bd", peri: "#81a2ef", ink: "#273339" };

export const Avatar = ({ name, i = 0, size = 32 }: { name: string; i?: number; size?: number }) => {
  const bg = [C.brand, C.teal, C.sand, C.peri, C.ink][i % 5];
  return <span className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white font-display text-xs font-bold text-white" style={{ width: size, height: size, background: bg }} aria-hidden>{name.trim()[0]?.toUpperCase()}</span>;
};
