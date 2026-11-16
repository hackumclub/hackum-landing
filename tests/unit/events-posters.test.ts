import { describe, expect, it } from "vitest";
import { posterSrc, POSTER_LIBRARY } from "@/lib/events/posters";
import { PRESET_TEST, PRESETS, type PresetRow } from "@/lib/events/list-presets";

describe("posterSrc", () => {
  it("accepts local image files and trims", () => {
    expect(posterSrc(" /img/posters/meetup-1.jpg ")).toBe("/img/posters/meetup-1.jpg");
    expect(posterSrc("/a/b.WEBP")).toBe("/a/b.WEBP");
  });
  it("rejects empty, remote, traversal and non-image paths", () => {
    for (const bad of [null, undefined, "", "   ", "https://evil.example/x.jpg", "//evil.example/x.jpg", "/img/../secret.jpg", "/img/x.svg", "img/x.jpg", "javascript:alert(1)"]) expect(posterSrc(bad)).toBeNull();
  });
  it("every library poster is a valid path", () => {
    for (const p of POSTER_LIBRARY) expect(posterSrc(p.path)).toBe(p.path);
  });
});

describe("dashboard deep-link presets", () => {
  const row = (o: Partial<PresetRow>): PresetRow => ({ stored: "published", applied: 0, cover: "/x.jpg", noEnTitle: false, ...o });
  it("names every preset the dashboard links to", () => expect(PRESETS).toEqual(["applications", "missing_cover", "needs_en"]));
  it("applications: published events with applications waiting", () => {
    expect(PRESET_TEST.applications(row({ applied: 3 }))).toBe(true);
    expect(PRESET_TEST.applications(row({ applied: 3, stored: "draft" }))).toBe(false);
    expect(PRESET_TEST.applications(row({ applied: 0 }))).toBe(false);
  });
  it("missing_cover / needs_en ignore finished events like the dashboard count", () => {
    expect(PRESET_TEST.missing_cover(row({ cover: null }))).toBe(true);
    expect(PRESET_TEST.missing_cover(row({ cover: null, stored: "archived" }))).toBe(false);
    expect(PRESET_TEST.needs_en(row({ noEnTitle: true, stored: "draft" }))).toBe(true);
    expect(PRESET_TEST.needs_en(row({ noEnTitle: true, stored: "completed" }))).toBe(false);
  });
});
