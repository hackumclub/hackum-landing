// Client-side avatar pipeline: decode → center-crop to a square → scale down (never up) → re-encode as WebP.
// Re-encoding through a canvas is what drops EXIF (GPS, camera, thumbnails); the server still re-validates everything.
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
/** What the server accepts after resizing (src/lib/mockdb/avatars.ts MAX_AVATAR_BYTES); a bigger result is retried as JPEG. */
const MAX_OUTPUT_BYTES = 1_000_000;
const QUALITY = 0.85;

export type ImageErrorCode = "too_large" | "unreadable" | "encode_failed";
export class ImageError extends Error {
  constructor(readonly code: ImageErrorCode) { super(code); this.name = "ImageError"; }
}

type Surface = { width: number; height: number; getContext: (id: "2d") => unknown };
type Ctx2d = { drawImage: (...a: [CanvasImageSource, number, number, number, number, number, number, number, number]) => void };

function makeSurface(side: number): { ctx: Ctx2d; encode: (type: string, q: number) => Promise<Blob | null> } {
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(side, side);
    const ctx = (c as unknown as Surface).getContext("2d") as Ctx2d | null;
    if (!ctx) throw new ImageError("encode_failed");
    return { ctx, encode: (type, q) => c.convertToBlob({ type, quality: q }).catch(() => null) };
  }
  const c = document.createElement("canvas");
  c.width = side; c.height = side;
  const ctx = c.getContext("2d") as unknown as Ctx2d | null;
  if (!ctx) throw new ImageError("encode_failed");
  return { ctx, encode: (type, q) => new Promise<Blob | null>((res) => c.toBlob(res, type, q)) };
}

/**
 * Returns a square image of at most `max` px per side (and never larger than the picture's short side).
 * Throws ImageError: `too_large` (source above 5 MB), `unreadable` (not an image the browser can decode), `encode_failed`.
 */
export async function resizeImage(file: File, max = 512): Promise<Blob> {
  if (file.size > MAX_SOURCE_BYTES) throw new ImageError("too_large");
  if (file.size === 0 || !file.type.startsWith("image/")) throw new ImageError("unreadable");
  if (typeof createImageBitmap === "undefined") throw new ImageError("unreadable");

  let bitmap: ImageBitmap;
  try {
    // "from-image" bakes the EXIF rotation into the pixels before the metadata is thrown away.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("unreadable");
  }
  try {
    const short = Math.min(bitmap.width, bitmap.height);
    if (!(short > 0)) throw new ImageError("unreadable");
    const side = Math.max(1, Math.min(Math.floor(max), short));
    const sx = Math.floor((bitmap.width - short) / 2);
    const sy = Math.floor((bitmap.height - short) / 2);
    const { ctx, encode } = makeSurface(side);
    ctx.drawImage(bitmap, sx, sy, short, short, 0, 0, side, side);

    let blob = await encode("image/webp", QUALITY);
    if (!blob || blob.type !== "image/webp" || blob.size > MAX_OUTPUT_BYTES) blob = await encode("image/jpeg", QUALITY - 0.05);
    if (!blob || blob.size === 0 || blob.size > MAX_OUTPUT_BYTES) throw new ImageError("encode_failed");
    return blob;
  } finally {
    bitmap.close?.();
  }
}
