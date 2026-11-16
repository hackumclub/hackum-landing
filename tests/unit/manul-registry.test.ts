// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STICKERS } from "@/lib/manul";

const DIR = path.join(process.cwd(), "public/img/manul");
const size = (file: string) => { const b = readFileSync(path.join(DIR, file)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }; // PNG IHDR

describe("sticker registry", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".png"));
  it("has an entry for every sticker image, and no entry without an image", () => {
    expect(Object.keys(STICKERS).sort()).toEqual(files.map((f) => f.replace(/\.png$/, "")).sort());
  });
  it("records each image's real pixel size (next/image needs it to reserve space)", () => {
    for (const [name, s] of Object.entries(STICKERS)) expect({ name, ...size(`${name}.png`) }).toEqual({ name, w: s.w, h: s.h });
  });
  it("describes every sticker in both languages", () => {
    for (const [name, s] of Object.entries(STICKERS)) {
      expect(s.alt.mn.trim(), name).not.toBe("");
      expect(s.alt.en.trim(), name).not.toBe("");
    }
  });
});
