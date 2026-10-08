import Image from "next/image";
import { STICKERS, type StickerName } from "@/lib/manul";

/**
 * A single Мануул sticker. Decorative by default; pass `label` when it carries meaning.
 * Served through next/image (AVIF/WebP at display size); `sizes` should match the rendered width.
 */
export default function Sticker({ name, className = "", label, style, sizes = "200px", eager = false }: {
  name: StickerName; className?: string; label?: string; style?: React.CSSProperties; sizes?: string;
  /** Above-the-fold stickers (the hero) load eagerly; they can be the page's LCP element. Everything else stays lazy. */
  eager?: boolean;
}) {
  const s = STICKERS[name];
  return (
    <Image
      src={s.src}
      width={s.w}
      height={s.h}
      sizes={sizes}
      loading={eager ? "eager" : undefined}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      draggable={false}
      style={style}
      className={`h-auto select-none [filter:drop-shadow(0_10px_14px_rgb(14_26_43/0.28))] ${className}`}
    />
  );
}
