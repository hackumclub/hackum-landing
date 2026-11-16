import { cx } from "./cx";

/** Up to two initials from a display name ("?" when empty). Works for Cyrillic. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * Round photo or letter fallback. Photos are plain <img>: they are tiny (≤ 512 px WebP re-encoded on upload), served with
 * their own immutable cache headers by /api/avatar, and carry a `?v=` query that next/image's optimizer would reject.
 * `alt` is empty by default because a name is almost always printed next to the picture; pass it when it stands alone.
 */
export default function Avatar({ name, src, size = 32, className, alt = "" }: { name: string; src?: string | null; size?: number; className?: string; alt?: string }) {
  const style = { width: size, height: size };
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img src={src} alt={alt} width={size} height={size} loading="lazy" decoding="async" className={cx("shrink-0 rounded-full object-cover", className)} style={style} />
  ) : (
    <span aria-hidden="true" style={{ ...style, fontSize: Math.round(size * 0.38) }} className={cx("inline-grid shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent-fg", className)}>
      {initials(name)}
    </span>
  );
}

/** Overlapping avatars + "+N"; `label` is the accessible summary ("24 people going"). */
export function AvatarStack({ people, max = 5, label }: { people: { name: string; src?: string | null }[]; max?: number; label: string }) {
  const shown = people.slice(0, max);
  return (
    <div role="img" aria-label={label} className="flex items-center">
      {shown.map((p, i) => <Avatar key={i} name={p.name} src={p.src} size={28} className="-ml-2 ring-2 ring-panel first:ml-0" />)}
      {people.length > max && <span aria-hidden="true" className="tnum -ml-2 grid size-7 place-items-center rounded-full bg-neutral-soft text-xs font-bold text-fg ring-2 ring-panel">+{people.length - max}</span>}
    </div>
  );
}
