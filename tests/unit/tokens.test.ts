// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Parse `--ops-*: #hex;` declarations from one CSS block (the first block whose selector matches). */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector + " {");
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--ops-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const css = readFileSync(path.join(__dirname, "../../src/app/globals.css"), "utf8");
const THEMES = { light: block(css, ".ops"), dark: block(css, '.ops[data-theme="dark"]') };

// [foreground, background] pairs that carry text: WCAG 2.2 SC 1.4.3 → 4.5:1.
const TEXT: [string, string][] = [
  ["fg", "canvas"], ["fg", "panel"], ["fg", "panel-2"],
  ["fg-muted", "canvas"], ["fg-muted", "panel"], ["fg-muted", "panel-2"],
  ["on-accent", "accent"], ["on-accent", "accent-hover"],
  ["accent-fg", "canvas"], ["accent-fg", "panel"], ["accent-fg", "accent-soft"],
  ["ok-fg", "panel"], ["ok-fg", "ok-soft"],
  ["warn-fg", "panel"], ["warn-fg", "warn-soft"],
  ["danger-fg", "panel"], ["danger-fg", "danger-soft"], ["on-danger", "danger"],
  ["fg", "neutral-soft"],
  // Logo ember: text tone for "almost full / hot" states.
  ["ember-fg", "canvas"], ["ember-fg", "panel"], ["ember-fg", "ember-soft"],
];
// UI boundaries and focus rings: SC 1.4.11 → 3:1.
const NON_TEXT: [string, string][] = [
  ["line-strong", "panel"], ["line-strong", "canvas"], ["accent", "canvas"], ["accent", "panel"],
  // Chart marks drawn from the logo mesh (blue, yellow, green, ember) + neutral; each must stand out from both surfaces.
  ...["c1", "c2", "c3", "c4", "c5"].flatMap((c): [string, string][] => [[c, "panel"], [c, "canvas"]]),
  ["ember", "panel"],
];

describe.each(Object.entries(THEMES))("%s theme tokens", (_name, t) => {
  it.each(TEXT)("text %s on %s ≥ 4.5:1", (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
  it.each(NON_TEXT)("non-text %s on %s ≥ 3:1", (fg, bg) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});

it("dark theme also applies under prefers-color-scheme unless light is forced", () => {
  expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*{\s*\.ops:not\(\[data-theme="light"\]\)/);
  // The two dark blocks are written out twice (CSS has no mixins); they must never drift apart.
  expect(block(css, '.ops:not([data-theme="light"])')).toEqual(THEMES.dark);
});

// The Hackum "stage" (big blue header panel) and the brand-blue sidebar look the same in light and dark, so they live
// once in the .ops block. Text on them must still meet AA.
describe("brand stage and chrome (identical in both themes)", () => {
  const t = THEMES.light;
  const PAIRS: [string, string][] = [
    ["on-stage", "stage-a"], ["on-stage", "stage-b"], ["on-stage", "stage-c"],
    ["on-stage-lead", "stage-a"], ["on-stage-lead", "stage-b"],
    ["on-chrome", "chrome-a"], ["on-chrome", "chrome-b"], ["on-chrome", "chrome-c"],
    ["on-chrome-muted", "chrome-a"], ["on-chrome-muted", "chrome-b"], ["on-chrome-muted", "chrome-c"],
    ["on-gloss", "gloss-a"], ["on-gloss", "gloss-b"],
    ["chrome-active-fg", "chrome-active-bg"],
  ];
  it.each(PAIRS)("text %s on %s ≥ 4.5:1", (fg, bg) => {
    expect(t[fg], fg).toBeDefined();
    expect(t[bg], bg).toBeDefined();
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
