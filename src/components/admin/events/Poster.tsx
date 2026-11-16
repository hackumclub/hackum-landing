"use client";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";
import { posterSrc } from "@/lib/events/posters";
import { cx } from "@/components/ui/cx";

/**
 * A real thumbnail of the event poster, or a calm placeholder when there is none (or the file does not exist).
 * Decorative: the event title is always written next to it. The wrapper sets the size and aspect via className.
 */
export default function Poster({ path, sizes, className, onBroken }: { path: string | null | undefined; sizes: string; className?: string; onBroken?: (broken: boolean) => void }) {
  const src = posterSrc(path);
  const [failed, setFailed] = useState<string | null>(null);
  const ok = src !== null && failed !== src;
  return (
    <span aria-hidden="true" className={cx("relative block shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-neutral-soft", className)}>
      {ok ? (
        <Image
          src={src} alt="" fill sizes={sizes} className="object-cover" draggable={false}
          onError={() => { setFailed(src); onBroken?.(true); }}
          onLoad={() => onBroken?.(false)}
        />
      ) : (
        <span className="grid size-full place-items-center text-fg-muted"><ImageOff size={18} /></span>
      )}
    </span>
  );
}
