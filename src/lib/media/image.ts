// Header-level image checks for uploads. The browser already re-encodes (resize + strips EXIF); the server never trusts
// that: it decides the type from magic bytes, reads the claimed size without decoding any pixels, and removes metadata.
export type ImageKind = "png" | "jpeg" | "webp";

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32le = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 8 && PNG_SIG.every((v, i) => b[i] === v)) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
const NO_LENGTH = (m: number) => m === 0x01 || m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7);

/** Pixel size claimed by the header (null if unreadable). Used to refuse decompression bombs before anything decodes. */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const kind = sniffImage(b);
  if (kind === "png") return b.length >= 24 ? { w: u32be(b, 16), h: u32be(b, 20) } : null;
  if (kind === "jpeg") {
    let i = 2;
    while (i + 3 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (NO_LENGTH(m)) { i += 2; continue; }
      if (SOF.has(m)) return i + 8 < b.length ? { h: u16be(b, i + 5), w: u16be(b, i + 7) } : null;
      if (m === 0xda) return null;
      i += 2 + u16be(b, i + 2);
    }
    return null;
  }
  if (kind === "webp" && b.length >= 30) {
    const type = ascii(b, 12, 4);
    const d = 20;
    if (type === "VP8 " && b[d + 3] === 0x9d && b[d + 4] === 0x01 && b[d + 5] === 0x2a) return { w: u16le(b, d + 6) & 0x3fff, h: u16le(b, d + 8) & 0x3fff };
    if (type === "VP8L" && b[d] === 0x2f) return { w: 1 + (b[d + 1] | ((b[d + 2] & 0x3f) << 8)), h: 1 + ((b[d + 2] >> 6) | (b[d + 3] << 2) | ((b[d + 4] & 0x0f) << 10)) };
    if (type === "VP8X") return { w: 1 + u24le(b, d + 4), h: 1 + u24le(b, d + 7) };
  }
  return null;
}

const PNG_DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
const JPEG_DROP = new Set([0xe1, 0xed, 0xfe]); // EXIF/XMP, Photoshop IRB, comments

/** The same picture without location/camera metadata; null when the bytes cannot be made safe (e.g. WebP carrying EXIF). */
export function stripMetadata(b: Uint8Array): Uint8Array | null {
  const kind = sniffImage(b);
  if (kind === "png") {
    const out: number[] = [...b.subarray(0, 8)];
    for (let i = 8; i + 12 <= b.length;) {
      const len = u32be(b, i), end = i + 12 + len;
      if (end > b.length) return null;
      if (!PNG_DROP.has(ascii(b, i + 4, 4))) for (let k = i; k < end; k++) out.push(b[k]);
      i = end;
    }
    return Uint8Array.from(out);
  }
  if (kind === "jpeg") {
    const out: number[] = [0xff, 0xd8];
    let i = 2;
    while (i + 3 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (NO_LENGTH(m)) { out.push(0xff, m); i += 2; continue; }
      const end = i + 2 + u16be(b, i + 2);
      if (end > b.length) return null;
      if (m === 0xda) { for (let k = i; k < b.length; k++) out.push(b[k]); return Uint8Array.from(out); } // entropy-coded data to the end
      if (!JPEG_DROP.has(m)) for (let k = i; k < end; k++) out.push(b[k]);
      i = end;
    }
    return null;
  }
  if (kind === "webp") {
    for (let i = 12; i + 8 <= b.length;) {
      const id = ascii(b, i, 4);
      if (id === "EXIF" || id === "XMP ") return null;
      i += 8 + u32le(b, i + 4) + (u32le(b, i + 4) % 2);
    }
    return b;
  }
  return null;
}
