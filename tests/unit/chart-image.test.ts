import { describe, expect, it } from "vitest";
import { buildExportSvg, EXPORT_SCALE, excluded, figureToSvg, inlinePaint, type Measure, type Rect } from "@/components/reports/chart-image";

const SVG = "http://www.w3.org/2000/svg";
const parse = (markup: string) => new DOMParser().parseFromString(markup, "image/svg+xml");
const svgEl = (viewBox: string) => {
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("width", "100%");
  s.setAttribute("style", "display:block;height:auto");
  const r = document.createElementNS(SVG, "rect");
  r.setAttribute("width", "10");
  s.append(r);
  return s;
};

describe("buildExportSvg (a bare chart svg)", () => {
  it("size is the viewBox times 2, a white background rect comes first, and the source is untouched", () => {
    const src = svgEl("0 0 320 180");
    const out = buildExportSvg(src, { width: 1, height: 1 });
    expect(EXPORT_SCALE).toBe(2);
    expect([out.width, out.height]).toEqual([640, 360]);
    const root = parse(out.markup).documentElement;
    expect(root.namespaceURI).toBe(SVG);
    expect([root.getAttribute("width"), root.getAttribute("height"), root.getAttribute("viewBox")]).toEqual(["640", "360", "0 0 320 180"]);
    expect(root.getAttribute("style")).toBeNull();
    const first = root.firstElementChild!;
    expect([first.localName, first.getAttribute("width"), first.getAttribute("height"), first.getAttribute("fill")]).toEqual(["rect", "320", "180", "white"]);
    expect(src.getAttribute("width")).toBe("100%");
    expect(src.childElementCount).toBe(1);
  });
  it("an offset viewBox puts the background on its origin; custom scale and background are honoured", () => {
    const first = parse(buildExportSvg(svgEl("-10 -5 100 50"), { width: 1, height: 1 }).markup).documentElement.firstElementChild!;
    expect([first.getAttribute("x"), first.getAttribute("y")]).toEqual(["-10", "-5"]);
    const out = buildExportSvg(svgEl("0 0 50 20"), { width: 1, height: 1 }, { scale: 3, background: "black" });
    expect([out.width, out.height]).toEqual([150, 60]);
    expect(parse(out.markup).documentElement.firstElementChild!.getAttribute("fill")).toBe("black");
  });
  it("without a viewBox it falls back to the measured size and never makes a zero-size image", () => {
    const s = document.createElementNS(SVG, "svg");
    expect(buildExportSvg(s, { width: 10.2, height: 5.1 })).toMatchObject({ width: 22, height: 12 });
    expect(buildExportSvg(s, { width: 0, height: Number.NaN }).width).toBeGreaterThan(0);
  });
});

/** jsdom has no layout, so boxes and word boxes are injected by data attributes: data-box="left,top,w,h". */
const box = (el: Element): Rect => { const [left, top, width, height] = (el.getAttribute("data-box") ?? "0,0,0,0").split(",").map(Number); return { left, top, width, height }; };
const measure: Measure = {
  rect: box,
  words: (t) => {
    const [left, top, width, height] = (t.parentElement!.getAttribute("data-words") ?? "0,0,0,0").split(",").map(Number);
    const words = t.data.match(/\S+/g) ?? [];
    return words.map((w, i) => ({ text: w, rect: { left: left + i * (width / words.length), top, width: width / words.length, height } }));
  },
};
const styles: Record<string, Record<string, string>> = {
  figure: { display: "grid", "background-color": "rgb(255, 255, 255)", "border-top-left-radius": "20px", "border-top-width": "0px", color: "rgb(10, 10, 10)", "font-size": "16px", "font-weight": "400", "font-style": "normal", "font-family": '"Nunito Sans"', "letter-spacing": "normal" },
  default: { display: "block", "background-color": "rgba(0, 0, 0, 0)", "border-top-width": "0px", color: "rgb(10, 10, 10)", "font-size": "16px", "font-weight": "700", "font-style": "normal", "font-family": '"Nunito Sans"', "letter-spacing": "normal", "background-image": "none" },
  swatch: { display: "block", "background-color": "rgb(156, 127, 0)", "border-top-left-radius": "3px", "border-top-width": "0px", "background-image": "none" },
  hidden: { display: "none" },
  inner: { fill: 'url("http://localhost:3100/en/admin/x#hatch-3")', stroke: "none", "stroke-width": "2px" },
};
const read = (el: Element) => {
  const key = el.getAttribute("data-style") ?? (el.tagName === "FIGURE" ? "figure" : isSvgInner(el) ? "inner" : "default");
  const o = { ...styles.default, ...(styles[key] ?? {}) };
  const names = Object.keys(o);
  return Object.assign(names, { getPropertyValue: (n: string) => o[n] ?? "", length: names.length }) as unknown as CSSStyleDeclaration;
};
const isSvgInner = (el: Element) => el.namespaceURI === SVG;

function figure() {
  const f = document.createElement("figure");
  f.setAttribute("data-box", "100,50,300,200");
  f.innerHTML = `
    <h2 data-box="116,66,200,24" data-words="116,66,200,24">Funnel &amp; "steps" Ө Ү</h2>
    <p data-box="116,94,260,36" data-words="116,94,260,36">Short takeaway sentence</p>
    <span data-style="swatch" data-box="116,140,12,12"></span>
    <button data-box="300,66,80,30">Download image</button>
    <div class="sr-only" data-box="0,0,1,1">Hidden table cell</div>
    <div data-style="hidden" data-box="0,0,50,50">never shown</div>
    <svg width="0" height="0" data-box="0,0,0,0"><defs><pattern id="hatch-3"><rect width="3" height="3"/></pattern></defs></svg>
    <svg width="100%" height="14" data-box="116,160,260,14"><rect width="45%" height="14" rx="4" style="fill:url(#hatch-3)"/></svg>`;
  return f;
}

describe("figureToSvg: a pure SVG, no foreignObject", () => {
  const run = () => figureToSvg(figure(), { width: 300, height: 200 }, { read, measure, origin: { left: 100, top: 50 } });
  it("is a well-formed 2× SVG with a white background and no foreignObject, button or hidden text", () => {
    const out = run();
    expect([out.width, out.height]).toEqual([600, 400]);
    const doc = parse(out.markup);
    expect(doc.querySelector("parsererror")).toBeNull();
    const root = doc.documentElement;
    expect([root.getAttribute("width"), root.getAttribute("height"), root.getAttribute("viewBox")]).toEqual(["600", "400", "0 0 300 200"]);
    expect(root.firstElementChild!.getAttribute("fill")).toBe("white");
    expect(out.markup).not.toMatch(/foreignObject|<button|Download image|Hidden table|never shown/);
  });
  it("draws the figure box and the swatch as rects in the figure's own coordinates", () => {
    const rects = [...parse(run().markup).querySelectorAll("svg > rect")];
    const bg = rects.find((r) => r.getAttribute("rx") === "20")!;
    expect([bg.getAttribute("x"), bg.getAttribute("y"), bg.getAttribute("width"), bg.getAttribute("height"), bg.getAttribute("fill")]).toEqual(["0", "0", "300", "200", "rgb(255, 255, 255)"]);
    const sw = rects.find((r) => r.getAttribute("rx") === "3")!;
    expect([sw.getAttribute("x"), sw.getAttribute("y"), sw.getAttribute("fill")]).toEqual(["16", "90", "rgb(156, 127, 0)"]); // a colour whose blue channel is 0 is not transparent
  });
  it("writes each line of words as one text stretched to its measured width, with Mongolian letters and escaping intact", () => {
    const texts = [...parse(run().markup).querySelectorAll("text")];
    expect(texts.map((t) => t.textContent)).toEqual(['Funnel & "steps" Ө Ү', "Short takeaway sentence"]);
    const t = texts[0];
    expect([t.getAttribute("x"), t.getAttribute("textLength"), t.getAttribute("lengthAdjust")]).toEqual(["16", "200", "spacingAndGlyphs"]);
    expect(Number(t.getAttribute("y"))).toBeGreaterThan(16);
    expect(t.getAttribute("style")).toContain("font-weight:700");
    expect(t.getAttribute("style")).toContain("ui-sans-serif");
  });
  it("embeds the chart's own svgs at their boxes, keeps pattern defs, and points fills at local ids", () => {
    const svgs = [...parse(run().markup).querySelectorAll("svg > svg")];
    expect(svgs).toHaveLength(2);
    expect(svgs[0].querySelector("pattern")).not.toBeNull(); // the zero-size defs svg stays
    const bar = svgs[1];
    expect([bar.getAttribute("x"), bar.getAttribute("y"), bar.getAttribute("width"), bar.getAttribute("height")]).toEqual(["16", "110", "260", "14"]);
    expect(bar.querySelector("rect")!.getAttribute("style")).toMatch(/fill:\s*url\("?#hatch-3"?\)/);
    expect(bar.getAttribute("class")).toBeNull();
  });
});

describe("excluded", () => {
  it("skips download buttons, the screen-reader table and images", () => {
    const mk = (html: string) => { const d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild!; };
    expect(excluded(mk("<button>x</button>"))).toBe(true);
    expect(excluded(mk("<span data-noexport>x</span>"))).toBe(true);
    expect(excluded(mk('<div class="sr-only">x</div>'))).toBe(true);
    expect(excluded(mk("<img>"))).toBe(true);
    expect(excluded(mk("<p>x</p>"))).toBe(false);
  });
});

describe("inlinePaint", () => {
  it("copies paint and text properties (never layout) from the live element to the clone, and drops classes", () => {
    const src = svgEl("0 0 10 10");
    src.firstElementChild!.setAttribute("class", "fill-c1");
    const dst = src.cloneNode(true) as Element;
    inlinePaint(src, dst, () => {
      const o: Record<string, string> = { fill: "rgb(1, 2, 3)", "font-family": "Nunito", width: "999px" };
      return Object.assign(Object.keys(o), { getPropertyValue: (n: string) => o[n] ?? "" }) as unknown as CSSStyleDeclaration;
    });
    const r = dst.firstElementChild as SVGElement;
    expect(r.style.fill).toBe("rgb(1, 2, 3)");
    expect(r.style.fontFamily).toContain("ui-sans-serif");
    expect(r.style.width).toBe("");
    expect(r.getAttribute("class")).toBeNull();
  });
});
