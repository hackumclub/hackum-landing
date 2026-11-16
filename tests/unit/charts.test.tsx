import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import AreaChart from "@/components/charts/AreaChart";
import BarChart from "@/components/charts/BarChart";
import FunnelChart from "@/components/charts/FunnelChart";
import DonutChart from "@/components/charts/DonutChart";
import HeatStrip from "@/components/charts/HeatStrip";
import { arcPath, foldSlices, funnelSteps, niceScale, shareOf } from "@/components/charts/scale";

const noNaN = (c: HTMLElement) => {
  const html = c.innerHTML;
  expect(html).not.toMatch(/NaN|Infinity|undefined/);
};
const tableRows = (c: HTMLElement) => within(c.querySelector("table")!).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell", { hidden: true }).map((x) => x.textContent));
const rowHeads = (c: HTMLElement) => [...c.querySelectorAll("tbody th")].map((x) => x.textContent);

describe("scale helpers", () => {
  it("niceScale picks round tick values and handles zero / tiny maxima", () => {
    expect(niceScale(0)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale(3).ticks.every(Number.isInteger)).toBe(true);
    expect(niceScale(37)).toMatchObject({ max: 40 });
    expect(niceScale(37).ticks).toEqual([0, 10, 20, 30, 40]);
    expect(niceScale(1)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] });
    expect(niceScale(Number.NaN).max).toBe(4);
  });
  it("shareOf never divides by zero", () => {
    expect(shareOf(1, 0)).toBeNull();
    expect(shareOf(1, 4)).toBe(0.25);
  });
  it("foldSlices keeps the top n and folds the rest into one Other slice", () => {
    const data = [5, 4, 3, 2, 1, 1].map((value, i) => ({ key: `k${i}`, label: `L${i}`, value }));
    const folded = foldSlices(data, 4, "Other");
    expect(folded.map((s) => s.label)).toEqual(["L0", "L1", "L2", "L3", "Other"]);
    expect(folded[4].value).toBe(2);
    expect(foldSlices(data.slice(0, 5), 4, "Other")).toHaveLength(5);
    expect(foldSlices(data.slice(0, 2), 4, "Other")).toHaveLength(2);
  });
  it("arcPath is finite for tiny, half and full sweeps", () => {
    for (const [a, b] of [[0, 0.0001], [0, Math.PI], [0, Math.PI * 2], [1, 1]]) expect(arcPath(60, 60, 40, a, b)).not.toMatch(/NaN|Infinity/);
    expect(arcPath(60, 60, 40, 0, Math.PI * 2).match(/A/g)).toHaveLength(2);
  });
  it("funnelSteps gives % of the previous step, null when that step is empty", () => {
    expect(funnelSteps([{ key: "a", label: "A", value: 10 }, { key: "b", label: "B", value: 5 }, { key: "c", label: "C", value: 5 }]).map((s) => s.ofPrevious)).toEqual([null, 0.5, 1]);
    expect(funnelSteps([{ key: "a", label: "A", value: 0 }, { key: "b", label: "B", value: 0 }]).map((s) => s.ofPrevious)).toEqual([null, null]);
  });
});

const points = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((key, i) => ({ key, label: `Nov ${i + 1}`, short: `${i + 1}`, value: [0, 3, 12, 7][i] }));

describe("AreaChart", () => {
  it("renders an accessible figure whose hidden table has exactly the numbers drawn", () => {
    const { container } = render(<AreaChart lang="en" title="Registrations by day" takeaway="12 on Nov 3" seriesLabel="Registrations" tableHead={["Day", "Registrations"]} points={points} />);
    const svg = container.querySelector("svg[role=img]")!;
    expect(svg).toBeTruthy();
    const names = svg.getAttribute("aria-labelledby")!.split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(names).toEqual(["Registrations by day", "12 on Nov 3"]);
    expect(rowHeads(container)).toEqual(["Nov 1", "Nov 2", "Nov 3", "Nov 4"]);
    expect(tableRows(container)).toEqual([["0"], ["3"], ["12"], ["7"]]);
    expect(container.querySelector("table")!.closest(".sr-only")).toBeTruthy();
    noNaN(container);
  });
  it("shows the last point's value as a direct label", () => {
    const { container } = render(<AreaChart lang="en" title="t" takeaway="k" seriesLabel="Registrations" tableHead={["Day", "n"]} points={points} />);
    expect(container.querySelector("[data-last-label]")?.textContent).toBe("7");
  });
  it("moves a tooltip with the arrow keys (one tab stop, not one per point)", () => {
    const { container } = render(<AreaChart lang="en" title="t" takeaway="k" seriesLabel="Registrations" tableHead={["Day", "n"]} points={points} />);
    const stop = screen.getByRole("group", { name: /arrow/i });
    expect(container.querySelectorAll("[tabindex='0']")).toHaveLength(1);
    fireEvent.focus(stop);
    fireEvent.keyDown(stop, { key: "Home" });
    expect(screen.getByRole("tooltip").textContent).toContain("Nov 1");
    fireEvent.keyDown(stop, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip").textContent).toMatch(/Nov 2.*3/);
    fireEvent.keyDown(stop, { key: "End" });
    expect(screen.getByRole("tooltip").textContent).toMatch(/Nov 4.*7/);
    fireEvent.blur(stop);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("empty, all-zero and single-point inputs never produce NaN", () => {
    for (const pts of [[], points.map((p) => ({ ...p, value: 0 })), [points[2]]]) {
      const { container, unmount } = render(<AreaChart lang="en" title="t" takeaway="k" seriesLabel="Registrations" tableHead={["Day", "n"]} points={pts} />);
      noNaN(container);
      unmount();
    }
  });
  it("shows the no-data state with a mascot instead of an empty plot", () => {
    const { container } = render(<AreaChart lang="en" title="t" takeaway="k" seriesLabel="Registrations" tableHead={["Day", "n"]} points={[]} />);
    expect(screen.getByText("No data for this range")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeTruthy();
    expect(container.querySelector("svg[role=img]")).toBeNull();
  });
});

describe("BarChart", () => {
  const groups = [{ key: "h", label: "Hackathon", values: [0.5] }, { key: "w", label: "Хэтэрхий урт монгол нэр бүхий ангилал", values: [null] }, { key: "m", label: "Meetup", values: [1] }];
  it("horizontal: every label is present in full, null shows an em dash, table matches", () => {
    const { container } = render(<BarChart lang="mn" title="Show rate" takeaway="k" groupHeader="Kind" series={[{ key: "r", label: "Show rate", color: 1 }]} groups={groups} unit="percent" max={1} />);
    expect(within(container.querySelector("ul")!).getByText("Хэтэрхий урт монгол нэр бүхий ангилал")).toBeInTheDocument();
    expect(tableRows(container)).toEqual([["50%"], ["—"], ["100%"]]);
    expect(container.querySelector("li span[class*='overflow-wrap']")).toBeTruthy();
    noNaN(container);
  });
  it("vertical, two series: legend text is always present and table has both columns", () => {
    const { container } = render(
      <BarChart lang="en" orientation="vertical" title="Semesters" takeaway="k" groupHeader="Semester"
        series={[{ key: "a", label: "Registrations", color: 1 }, { key: "b", label: "Attended", color: 3, pattern: true }]}
        groups={[{ key: "s1", label: "Autumn 2026", values: [40, 25] }, { key: "s2", label: "Spring 2027", values: [0, 0] }]} />,
    );
    expect(within(container.querySelector("figure")!).getAllByText("Attended").length).toBeGreaterThan(0);
    expect(tableRows(container)).toEqual([["40", "25"], ["0", "0"]]);
    noNaN(container);
  });
  it("all-zero and empty inputs have no NaN", () => {
    for (const g of [[], [{ key: "a", label: "A", values: [0] }]]) {
      const { container, unmount } = render(<BarChart lang="en" title="t" takeaway="k" groupHeader="g" series={[{ key: "r", label: "R", color: 1 }]} groups={g} />);
      noNaN(container);
      unmount();
    }
  });
});

describe("FunnelChart", () => {
  const steps = [{ key: "r", label: "Registered", value: 200 }, { key: "g", label: "Going", value: 150 }, { key: "a", label: "Attended", value: 90 }];
  it("shows % of the previous step and mirrors it in the table", () => {
    const { container } = render(<FunnelChart lang="en" title="Funnel" takeaway="k" tableHead={["Step", "People", "% of previous step"]} steps={steps} />);
    expect(screen.getByText("75% of previous step")).toBeInTheDocument();
    expect(screen.getByText("60% of previous step")).toBeInTheDocument();
    expect(tableRows(container)).toEqual([["200", "—"], ["150", "75%"], ["90", "60%"]]);
    noNaN(container);
  });
  it("zero steps never divide by zero", () => {
    const { container } = render(<FunnelChart lang="en" title="Funnel" takeaway="k" tableHead={["a", "b", "c"]} steps={steps.map((s) => ({ ...s, value: 0 }))} />);
    noNaN(container);
    expect(screen.getByText("No data for this range")).toBeInTheDocument();
  });
});

describe("DonutChart", () => {
  const d = (n: number[]) => n.map((value, i) => ({ key: `k${i}`, label: `Label ${i}`, value }));
  const base = { lang: "en" as const, title: "By school", takeaway: "k", centreLabel: "People", otherLabel: "Other", tableHead: ["School", "People", "Share"] as [string, string, string] };
  it("a single slice is a valid full ring and the centre shows the total", () => {
    const { container } = render(<DonutChart {...base} data={d([7])} />);
    const paths = [...container.querySelectorAll("svg[role=img] path")].map((p) => p.getAttribute("d")!);
    expect(paths).toHaveLength(1);
    expect(paths[0]).toMatch(/^M [\d. -]+ A [\d. -]+ A [\d. -]+$/);
    expect(container.querySelector("[data-total]")?.textContent).toBe("7");
    expect(tableRows(container)).toEqual([["7", "100%"]]);
    noNaN(container);
  });
  it("zero total draws only the empty ring state and no NaN", () => {
    const { container } = render(<DonutChart {...base} data={d([0, 0])} />);
    noNaN(container);
    expect(screen.getByText("No data for this range")).toBeInTheDocument();
  });
  it("many slices fold into Other (max 5 marks) and table totals still add up", () => {
    const { container } = render(<DonutChart {...base} data={d([9, 8, 7, 6, 5, 4, 3])} />);
    expect(container.querySelectorAll("svg[role=img] path")).toHaveLength(5);
    const rows = tableRows(container);
    expect(rows).toHaveLength(5);
    expect(rows.reduce((s, r) => s + Number(r[0]), 0)).toBe(42);
    expect(rowHeads(container).at(-1)).toBe("Other");
    noNaN(container);
  });
  it("legend lists each name with its count and share (never colour alone)", () => {
    render(<DonutChart {...base} data={d([3, 1])} />);
    expect(screen.getAllByText("Label 0").length).toBeGreaterThan(1);
    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
  });
});

describe("HeatStrip", () => {
  const cells = ["Mon", "Tue", "Wed"].map((label, i) => ({ key: label, label, value: [0, 4, 8][i] }));
  it("prints each value in its cell and mirrors it in the table", () => {
    const { container } = render(<HeatStrip lang="en" title="By weekday" takeaway="k" tableHead={["Day", "Registrations"]} cells={cells} />);
    expect(tableRows(container)).toEqual([["0"], ["4"], ["8"]]);
    expect(within(container.querySelector("[data-cells]")!).getByText("8")).toBeInTheDocument();
    noNaN(container);
  });
  it("all-zero input is the no-data state", () => {
    const { container } = render(<HeatStrip lang="en" title="t" takeaway="k" tableHead={["a", "b"]} cells={cells.map((c) => ({ ...c, value: 0 }))} />);
    expect(screen.getByText("No data for this range")).toBeInTheDocument();
    noNaN(container);
  });
});
