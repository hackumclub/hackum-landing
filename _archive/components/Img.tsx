/* eslint-disable @next/next/no-img-element -- remote illustrations/SVGs; next/image optimisation not wanted */
export default function Img({ src, alt = "", className }: { src: string; alt?: string; className?: string }) {
  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
}
