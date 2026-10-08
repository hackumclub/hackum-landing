import Image from "next/image";

type DataAttrs = { [key: `data-${string}`]: string | number | boolean | undefined };

/**
 * Decorative 3D icon from /public/img/icons3d (3dicons.co, CC0, plus our own send.png). The source PNGs are 400px;
 * next/image serves AVIF/WebP at the rendered size, so pass `sizes` ≈ the largest CSS width the icon reaches.
 * Lazy by default, which also stops React from adding a <link rel="preload"> for it. data-* attributes pass
 * through (animation hooks such as data-bob).
 */
export default function Icon3D({ name, className = "", sizes = "112px", style, ...data }: {
  name: string; className?: string; sizes?: string; style?: React.CSSProperties;
} & DataAttrs) {
  return <Image src={`/img/icons3d/${name}.png`} alt="" aria-hidden width={400} height={400} sizes={sizes} draggable={false} style={style} className={className} {...data} />;
}
