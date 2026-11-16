// Minimal, valid-enough image byte builders for header-level tests (no pixel data decoding happens on the server).
const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u32le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

export function png(w: number, h: number, extra: { type: string; data?: number[] }[] = []): Uint8Array {
  const chunk = (type: string, data: number[]) => [...u32be(data.length), ...ascii(type), ...data, 0, 0, 0, 0];
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk("IHDR", [...u32be(w), ...u32be(h), 8, 6, 0, 0, 0]),
    ...extra.flatMap((c) => chunk(c.type, c.data ?? [1, 2, 3])),
    ...chunk("IDAT", [0, 0, 0, 0]), ...chunk("IEND", []),
  ]);
}

export function jpeg(w: number, h: number, opts: { exif?: boolean } = {}): Uint8Array {
  const seg = (m: number, data: number[]) => [0xff, m, (data.length + 2) >> 8, (data.length + 2) & 255, ...data];
  return Uint8Array.from([
    0xff, 0xd8,
    ...(opts.exif ? seg(0xe1, [...ascii("Exif"), 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]) : []),
    ...seg(0xc0, [8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0]),
    ...seg(0xda, [1, 1, 0, 0, 0x3f, 0]), 1, 2, 3, 0xff, 0xd9,
  ]);
}

/** Lossy ("VP8 ") WebP header; with `exif` an EXIF chunk follows. */
export function webp(w: number, h: number, opts: { exif?: boolean } = {}): Uint8Array {
  const vp8 = [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, w & 255, (w >> 8) & 0x3f, h & 255, (h >> 8) & 0x3f, 0, 0];
  const chunks = [...ascii("VP8 "), ...u32le(vp8.length), ...vp8, ...(opts.exif ? [...ascii("EXIF"), ...u32le(4), 1, 2, 3, 4] : [])];
  return Uint8Array.from([...ascii("RIFF"), ...u32le(4 + chunks.length), ...ascii("WEBP"), ...chunks]);
}
export const bytesOf = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 255));
