// Chart → PNG, in the browser, with no dependency and no network. The figure (title, takeaway, legend, marks) is
// re-drawn as ONE pure SVG: boxes become <rect>, words become <text>, the chart's own <svg> elements are embedded with
// their paint styles written inline. No foreignObject (Chrome and Safari refuse to export a canvas that drew one),
// no web fonts (an SVG drawn as an image cannot load them), a white background, 2× scale. The SVG is drawn into a
// canvas through a blob URL and saved as PNG. Everything except `exportFigure` is pure and unit-tested with injected
// measurements, because jsdom has no layout.

export const EXPORT_SCALE = 2;
/** System fonts only; the stack ends in fonts every OS has (Cyrillic included). */
export const FONT_FALLBACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const SVG_NS = "http://www.w3.org/2000/svg";
const MAX_SIDE = 8192;
const PAINT_PROPS = [
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "color",
  "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor", "dominant-baseline", "paint-order", "font-variant-numeric", "visibility",
] as const;

export type StyleReader = (el: Element) => CSSStyleDeclaration;
export type Rect = { left: number; top: number; width: number; height: number };
export type Measure = {
  /** Box of an element, in the same coordinates as `origin`. */
  rect: (el: Element) => Rect;
  /** One entry per word of a text node, with the box that word occupies. */
  words: (text: Text) => { text: string; rect: Rect }[];
};
export type ExportSvg = { markup: string; width: number; height: number };

const isSvg = (el: Element) => el.namespaceURI === SVG_NS;
const positive = (n: number) => (Number.isFinite(n) && n > 0 ? Math.ceil(n) : 1);
const serialize = (el: Element) => new XMLSerializer().serializeToString(el);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n: number) => String(Math.round(n * 100) / 100);
// `fill: url(#hatch)` is reported as an absolute URL; inside a stand-alone SVG it must point at the local id again.
const localRefs = (v: string) => v.replace(/url\(\s*["']?[^"')#]*#([^"')\s]+)["']?\s*\)/g, "url(#$1)");
const transparent = (c: string) => c === "" || c === "transparent" || /^rgba\([^)]*,\s*0(\.0+)?\)$/.test(c) || /\/\s*0(\.0+)?\s*\)$/.test(c);

/** Elements that never appear in the picture: the buttons marked data-noexport and the visually hidden data table. */
export const excluded = (el: Element): boolean => el.hasAttribute("data-noexport") || el.classList.contains("sr-only") || ["SCRIPT", "STYLE", "IMG", "BUTTON"].includes(el.tagName);

/** Writes the paint and text properties of `src` (computed) onto `dst` as inline style, for the element and every descendant. */
export function inlinePaint(src: Element, dst: Element, read: StyleReader = (el) => getComputedStyle(el)): void {
  const from = [src, ...src.querySelectorAll("*")];
  const to = [dst, ...dst.querySelectorAll("*")];
  from.forEach((s, i) => {
    const d = to[i] as HTMLElement | undefined;
    if (!d) return;
    const cs = read(s);
    for (const name of PAINT_PROPS) {
      const v = cs.getPropertyValue(name);
      if (v !== "") d.style.setProperty(name, name === "font-family" ? `${v}, ${FONT_FALLBACK}` : localRefs(v));
    }
    d.removeAttribute("class");
  });
}

/** The stand-alone SVG for a bare chart `<svg>`: size is the viewBox ×scale, a background rect first, the source untouched. */
export function buildExportSvg(source: Element, size: { width: number; height: number }, opts: { scale?: number; background?: string } = {}): ExportSvg {
  const scale = opts.scale ?? EXPORT_SCALE;
  const bg = opts.background ?? "white";
  const clone = source.cloneNode(true) as Element;
  const vb = isSvg(source) ? source.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number) : undefined;
  const [x, y, w, h] = vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? vb : [0, 0, positive(size.width), positive(size.height)];
  const width = positive(w * scale), height = positive(h * scale);
  if (!vb) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.removeAttribute("style");
  const rect = document.createElementNS(SVG_NS, "rect");
  for (const [k, v] of [["x", x], ["y", y], ["width", w], ["height", h]] as const) rect.setAttribute(k, String(v));
  rect.setAttribute("fill", bg);
  clone.insertBefore(rect, clone.firstChild);
  return { markup: serialize(clone), width, height };
}

type Deps = { read: StyleReader; measure: Measure; origin: { left: number; top: number } };
const rel = (r: Rect, o: Deps["origin"]): Rect => ({ left: r.left - o.left, top: r.top - o.top, width: r.width, height: r.height });

function boxSvg(cs: CSSStyleDeclaration, r: Rect): string {
  if (r.width <= 0 || r.height <= 0) return "";
  const radius = Math.min(parseFloat(cs.getPropertyValue("border-top-left-radius")) || 0, r.width / 2, r.height / 2);
  const rx = radius > 0 ? ` rx="${num(radius)}"` : "";
  let out = "";
  let fill = cs.getPropertyValue("background-color");
  // Small swatches paint a hatch with a gradient (the second encoding next to colour): fall back to their outline colour.
  if (transparent(fill) && cs.getPropertyValue("background-image") !== "none" && r.width <= 24 && r.height <= 24) fill = cs.getPropertyValue("outline-color");
  if (!transparent(fill)) out += `<rect x="${num(r.left)}" y="${num(r.top)}" width="${num(r.width)}" height="${num(r.height)}"${rx} fill="${esc(fill)}"/>`;
  const bw = parseFloat(cs.getPropertyValue("border-top-width")) || 0;
  const bc = cs.getPropertyValue("border-top-color");
  if (bw > 0 && cs.getPropertyValue("border-top-style") !== "none" && !transparent(bc)) {
    out += `<rect x="${num(r.left + bw / 2)}" y="${num(r.top + bw / 2)}" width="${num(Math.max(0, r.width - bw))}" height="${num(Math.max(0, r.height - bw))}"${rx} fill="none" stroke="${esc(bc)}" stroke-width="${num(bw)}"/>`;
  }
  return out;
}

/** Words that share a line become one <text>, stretched to the width the page gave them, so the fallback font cannot overlap its neighbours. */
function textSvg(node: Text, parentStyle: CSSStyleDeclaration, d: Deps): string {
  const lines: { text: string; rect: Rect }[] = [];
  for (const w of d.measure.words(node)) {
    const r = rel(w.rect, d.origin);
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.rect.top - r.top) < Math.max(2, r.height / 2)) {
      const right = Math.max(last.rect.left + last.rect.width, r.left + r.width);
      last.text += ` ${w.text}`;
      last.rect = { left: Math.min(last.rect.left, r.left), top: last.rect.top, width: right - Math.min(last.rect.left, r.left), height: Math.max(last.rect.height, r.height) };
    } else lines.push({ text: w.text, rect: r });
  }
  const style = [
    `fill:${parentStyle.getPropertyValue("color")}`, `font-size:${parentStyle.getPropertyValue("font-size")}`, `font-weight:${parentStyle.getPropertyValue("font-weight")}`,
    `font-style:${parentStyle.getPropertyValue("font-style")}`, `font-family:${parentStyle.getPropertyValue("font-family")}, ${FONT_FALLBACK}`,
    `letter-spacing:${parentStyle.getPropertyValue("letter-spacing") === "normal" ? "0" : parentStyle.getPropertyValue("letter-spacing")}`,
  ].join(";").replace(/"/g, "'");
  return lines
    .filter((l) => l.rect.width > 0 && l.rect.height > 0)
    .map((l) => `<text x="${num(l.rect.left)}" y="${num(l.rect.top + l.rect.height * 0.78)}" textLength="${num(l.rect.width)}" lengthAdjust="spacingAndGlyphs" style="${style}" xml:space="preserve">${esc(l.text)}</text>`)
    .join("");
}

function nestedSvg(el: Element, r: Rect, d: Deps): string {
  // A zero-size <svg> may only declare patterns (hatch fills); the marks elsewhere refer to them by id, so keep it.
  if ((r.width <= 0 || r.height <= 0) && !el.querySelector("pattern, defs")) return "";
  const clone = el.cloneNode(true) as Element;
  inlinePaint(el, clone, d.read);
  clone.setAttribute("x", num(r.left));
  clone.setAttribute("y", num(r.top));
  clone.setAttribute("width", num(r.width));
  clone.setAttribute("height", num(r.height));
  clone.setAttribute("overflow", "visible");
  clone.removeAttribute("style");
  return serialize(clone);
}

function walk(el: Element, d: Deps): string {
  if (excluded(el)) return "";
  const cs = d.read(el);
  if (cs.getPropertyValue("display") === "none" || cs.getPropertyValue("visibility") === "hidden" || cs.getPropertyValue("opacity") === "0") return "";
  const r = rel(d.measure.rect(el), d.origin);
  if (isSvg(el)) return el.localName === "svg" ? nestedSvg(el, r, d) : "";
  let out = boxSvg(cs, r);
  for (const child of el.childNodes) {
    if (child.nodeType === 1) out += walk(child as Element, d);
    else if (child.nodeType === 3 && (child.textContent ?? "").trim() !== "") out += textSvg(child as Text, cs, d);
  }
  return out;
}

/** Re-draws `root` (a figure laid out at `size`) as one stand-alone SVG at `scale`× on a white background. */
export function figureToSvg(root: Element, size: { width: number; height: number }, deps: Deps, opts: { scale?: number; background?: string } = {}): ExportSvg {
  const scale = opts.scale ?? EXPORT_SCALE;
  const w = positive(size.width), h = positive(size.height);
  const width = positive(w * scale), height = positive(h * scale);
  const markup =
    `<svg xmlns="${SVG_NS}" width="${width}" height="${height}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="${opts.background ?? "white"}"/>${walk(root, deps)}</svg>`;
  return { markup, width, height };
}

/** Draws the SVG into a canvas and returns the PNG. Rejects (never hangs) when the browser cannot rasterise it. */
export async function svgToPng({ markup, width, height }: ExportSvg): Promise<Blob> {
  if (width > MAX_SIDE || height > MAX_SIDE) throw new Error("chart_image_too_large");
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("chart_image_load_failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("chart_image_no_canvas");
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("chart_image_encode_failed"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const WORD = /\S+/g;
/** Real measurements: element boxes from layout, one Range per word. */
export const browserMeasure: Measure = {
  rect: (el) => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; },
  words: (node) => {
    const out: { text: string; rect: Rect }[] = [];
    const range = document.createRange();
    for (const m of node.data.matchAll(WORD)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const r = range.getBoundingClientRect();
      out.push({ text: m[0], rect: { left: r.left, top: r.top, width: r.width, height: r.height } });
    }
    range.detach();
    return out;
  },
};

/**
 * Browser only. Lays a clone of `figure` out in an off-screen light-theme scope (an exported picture is always
 * dark-on-white, even in dark mode), re-draws it as a pure SVG, rasterises at 2× and saves `<name>.png`.
 */
export async function exportFigure(figure: HTMLElement, name: string): Promise<void> {
  const width = figure.getBoundingClientRect().width;
  const host = document.createElement("div");
  host.className = "ops";
  host.dataset.theme = "light";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:0;top:0;width:${Math.ceil(width)}px;visibility:hidden;pointer-events:none;z-index:-1`;
  const copy = figure.cloneNode(true) as HTMLElement;
  host.append(copy);
  document.body.append(host);
  try {
    // `visibility:hidden` on the host is only for the viewer; computed styles are read from the clone itself.
    copy.style.visibility = "visible";
    const box = copy.getBoundingClientRect();
    const png = await svgToPng(figureToSvg(copy, { width: box.width, height: box.height }, { read: (el) => getComputedStyle(el), measure: browserMeasure, origin: { left: box.left, top: box.top } }));
    saveBlob(png, name.endsWith(".png") ? name : `${name}.png`);
  } finally {
    host.remove();
  }
}
