import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageError, MAX_SOURCE_BYTES, resizeImage } from "@/lib/media/resizeImage";

type Draw = { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number };
const g = globalThis as unknown as Record<string, unknown>;

let drawn: Draw[];
let encodes: string[];
let canvases: { w: number; h: number; type?: string; quality?: number }[];
let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
let createImageBitmapMock: ReturnType<typeof vi.fn>;

const fileOf = (size = 1000, type = "image/jpeg") => {
  const f = new File([new Uint8Array(8)], "photo.jpg", { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

function installOffscreen(blobSize = 2000, ignoreWebp = false) {
  g.OffscreenCanvas = class {
    width: number; height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; canvases.push({ w, h }); }
    getContext() { return { drawImage: (_b: unknown, ...a: number[]) => { drawn.push({ sx: a[0], sy: a[1], sw: a[2], sh: a[3], dx: a[4], dy: a[5], dw: a[6], dh: a[7] }); } }; }
    convertToBlob(o: { type: string; quality: number }) {
      encodes.push(o.type);
      const c = canvases[canvases.length - 1]; c.type = o.type; c.quality = o.quality;
      return Promise.resolve(new Blob([new Uint8Array(blobSize)], { type: ignoreWebp && o.type === "image/webp" ? "image/png" : o.type }));
    }
  };
}

beforeEach(() => {
  drawn = []; canvases = []; encodes = [];
  bitmap = { width: 4000, height: 3000, close: vi.fn() };
  createImageBitmapMock = vi.fn(async () => bitmap);
  g.createImageBitmap = createImageBitmapMock;
  installOffscreen();
});
afterEach(() => { delete g.createImageBitmap; delete g.OffscreenCanvas; vi.restoreAllMocks(); });

describe("resizeImage", () => {
  it("rejects a source above 5 MB before decoding anything", async () => {
    await expect(resizeImage(fileOf(MAX_SOURCE_BYTES + 1))).rejects.toMatchObject({ code: "too_large" });
    expect(createImageBitmapMock).not.toHaveBeenCalled();
  });

  it("crops to a centered square and never exceeds 512 px", async () => {
    const out = await resizeImage(fileOf());
    expect(canvases[0].w).toBe(512);
    expect(canvases[0].h).toBe(512);
    expect(drawn[0]).toMatchObject({ sx: 500, sy: 0, sw: 3000, sh: 3000, dw: 512, dh: 512 });
    expect(out.type).toBe("image/webp");
    expect(bitmap.close).toHaveBeenCalled();
  });

  it("never upscales a small picture", async () => {
    bitmap = { width: 200, height: 100, close: vi.fn() };
    await resizeImage(fileOf());
    expect(canvases[0]).toMatchObject({ w: 100, h: 100 });
    expect(drawn[0]).toMatchObject({ sx: 50, sy: 0, sw: 100, sh: 100, dw: 100, dh: 100 });
  });

  it("honours a smaller max", async () => {
    await resizeImage(fileOf(), 256);
    expect(canvases[0].w).toBe(256);
  });

  it("re-encodes as WebP at 0.85 (which drops EXIF) and applies the photo orientation while decoding", async () => {
    const file = fileOf();
    const out = await resizeImage(file);
    expect(out).not.toBe(file);
    expect(canvases[0]).toMatchObject({ type: "image/webp", quality: 0.85 });
    expect(createImageBitmapMock).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
  });

  it("falls back to JPEG when the browser cannot write WebP", async () => {
    installOffscreen(2000, true); // browser ignored image/webp
    const out = await resizeImage(fileOf());
    expect(out.type).toBe("image/jpeg");
    expect(encodes).toEqual(["image/webp", "image/jpeg"]);
  });

  it("reports an unreadable file (a text file renamed .png) as unreadable", async () => {
    createImageBitmapMock.mockRejectedValueOnce(new Error("InvalidStateError"));
    await expect(resizeImage(fileOf(10, "image/png"))).rejects.toMatchObject({ code: "unreadable" });
  });

  it("rejects an empty or non-image type", async () => {
    await expect(resizeImage(fileOf(0))).rejects.toBeInstanceOf(ImageError);
    await expect(resizeImage(fileOf(10, "text/plain"))).rejects.toMatchObject({ code: "unreadable" });
  });

  it("uses a DOM canvas when OffscreenCanvas does not exist", async () => {
    delete g.OffscreenCanvas;
    const ctx2d = { drawImage: vi.fn((_b: unknown, ...a: number[]) => { drawn.push({ sx: a[0], sy: a[1], sw: a[2], sh: a[3], dx: a[4], dy: a[5], dw: a[6], dh: a[7] }); }) };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx2d as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback, type?: string) {
      canvases.push({ w: this.width, h: this.height, type });
      cb(new Blob([new Uint8Array(100)], { type }));
    });
    const out = await resizeImage(fileOf());
    expect(canvases[0]).toMatchObject({ w: 512, h: 512, type: "image/webp" });
    expect(out.type).toBe("image/webp");
  });

  it("fails clearly when the browser has no way to decode", async () => {
    delete g.createImageBitmap;
    await expect(resizeImage(fileOf())).rejects.toMatchObject({ code: "unreadable" });
  });
});
