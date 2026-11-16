// @vitest-environment node
import { describe, expect, it } from "vitest";
import { copy } from "@/i18n/areas/me";
import { BADGE_ART } from "@/components/me/badgeArt";
import { computeBadges } from "@/lib/me/badges";
import { emptyDb, addProfile, NOW } from "./helpers/fixture";
import { existsSync } from "node:fs";
import path from "node:path";

/** Flatten a copy tree into dotted keys → string. */
const flat = (o: unknown, prefix = ""): Record<string, string> =>
  typeof o === "string" ? { [prefix]: o }
    : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).flatMap(([k, v]) => Object.entries(flat(v, prefix ? `${prefix}.${k}` : k)))) : {};
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("member app copy", () => {
  const mn = flat(copy.mn), en = flat(copy.en);
  it("has the same keys in both languages and no empty strings", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(mn).sort());
    for (const [k, v] of [...Object.entries(mn), ...Object.entries(en)]) expect(v.trim(), k).not.toBe("");
  });
  it("uses the same {placeholders} in both languages (a translation cannot drop the event name or the date)", () => {
    for (const k of Object.keys(mn)) expect(placeholders(en[k]), k).toBe(placeholders(mn[k]));
  });
  it("Mongolian copy is Cyrillic, not English left in by mistake", () => {
    const loose = Object.entries(mn).filter(([k, v]) => !/[Ѐ-ӿ]/.test(v) && !/^(meta\.brand|home\.google|home\.ics|nav\.switchLang|settings\.vis|onboarding\.langEn|membership\.teams|apply\.errorsTitle|apply\.counter|membership\.counter|settings\.calHttps|profile\.linkKinds)/.test(k) && /[A-Za-z]{4,}/.test(v));
    expect(loose.map(([k]) => k)).toEqual([]);
  });
});

describe("badge art", () => {
  it("every badge id has art and the file exists", () => {
    const db = emptyDb(); addProfile(db, { id: "p" });
    for (const b of computeBadges(db, "p", NOW)) {
      expect(BADGE_ART[b.id], b.id).toBeTruthy();
      expect(existsSync(path.join(process.cwd(), "public/img/badges", `${BADGE_ART[b.id]}.png`)), b.id).toBe(true);
      expect(copy.mn.badges.items[b.id].name).toBeTruthy();
    }
  });
});
