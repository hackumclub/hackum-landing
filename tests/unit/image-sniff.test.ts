import { describe, expect, it } from "vitest";
import { imageSize, sniffImage, stripMetadata } from "@/lib/media/image";
import { bytesOf, jpeg, png, webp } from "./helpers/images";

describe("sniffImage (magic bytes, never the file name or declared type)", () => {
  it("recognises PNG, JPEG and WebP", () => {
    expect(sniffImage(png(10, 10))).toBe("png");
    expect(sniffImage(jpeg(10, 10))).toBe("jpeg");
    expect(sniffImage(webp(10, 10))).toBe("webp");
  });
  it.each([
    ["an SVG", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ["HTML", "<html><body>hi</body></html>"],
    ["text pretending to be a PNG", "PNG image, honest"],
    ["a GIF", "GIF89a......"],
    ["an empty file", ""],
  ])("rejects %s", (_n, text) => {
    expect(sniffImage(bytesOf(text))).toBeNull();
  });
  it("rejects a RIFF that is not WebP", () => {
    expect(sniffImage(bytesOf("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
  });
});

describe("imageSize reads dimensions from headers only", () => {
  it.each([["png", png(640, 480)], ["jpeg", jpeg(640, 480)], ["webp", webp(640, 480)]])("%s", (_n, b) => {
    expect(imageSize(b)).toEqual({ w: 640, h: 480 });
  });
  it("reads a huge claimed size without decoding anything", () => {
    expect(imageSize(png(20000, 20000))).toEqual({ w: 20000, h: 20000 });
  });
  it("returns null for a truncated header", () => {
    expect(imageSize(png(10, 10).slice(0, 20))).toBeNull();
    expect(imageSize(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull();
  });
});

describe("stripMetadata removes location-bearing segments", () => {
  it("drops the JPEG EXIF segment and keeps the picture valid", () => {
    const withExif = jpeg(8, 8, { exif: true });
    const clean = stripMetadata(withExif)!;
    expect(clean.length).toBeLessThan(withExif.length);
    expect(Buffer.from(clean).includes(Buffer.from("Exif"))).toBe(false);
    expect(sniffImage(clean)).toBe("jpeg");
    expect(imageSize(clean)).toEqual({ w: 8, h: 8 });
  });
  it("drops PNG text and exif chunks", () => {
    const dirty = png(8, 8, [{ type: "eXIf" }, { type: "tEXt" }, { type: "tIME" }]);
    const clean = stripMetadata(dirty)!;
    const s = Buffer.from(clean).toString("latin1");
    for (const t of ["eXIf", "tEXt", "tIME"]) expect(s.includes(t)).toBe(false);
    expect(imageSize(clean)).toEqual({ w: 8, h: 8 });
  });
  it("refuses a WebP that carries EXIF (it is re-encoded by the browser, so a real one never does)", () => {
    expect(stripMetadata(webp(8, 8, { exif: true }))).toBeNull();
    expect(stripMetadata(webp(8, 8))).not.toBeNull();
  });
});
