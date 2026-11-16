import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EventReportView from "@/components/admin/reports/EventReportView";
import PeriodReportView from "@/components/admin/reports/PeriodReportView";
import ReportProvider from "@/components/reports/ReportProvider";
import { periodReport, eventReport } from "@/lib/mockdb/reports";
import { buildSeed } from "@/lib/mockdb/seed";
import { semesterOf, semesterRange } from "@/lib/semester";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(cleanup);

const NOW = new Date("2026-11-16T04:00:00Z");
const db = buildSeed(NOW);
const ev = db.events.find((e) => e.slug === "pitch-night-autumn")!;
const eventView = (lang: "en" | "mn", event = ev, data = db) => render(<EventReportView report={eventReport(data, event.id)!} event={event} now={NOW} lang={lang} />);

describe("event report", () => {
  it("renders every section, KPI and chart, each chart with its own image download, and no NaN", () => {
    const { container } = eventView("en");
    for (const h of ["At a glance", "Who came", "Feedback"]) expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    for (const k of ["Registered", "Going", "Attended", "Show rate", "Average rating", "NPS", "Response rate"]) expect(screen.getByText(k, { selector: "p" })).toBeInTheDocument();
    const figures = screen.getAllByRole("figure");
    expect(figures.length).toBe(7);
    for (const f of figures) expect(within(f).getByRole("button", { name: /^Download image: / })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-chart-image]")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(screen.getByText("Choose “Save as PDF” in the print window.")).toBeInTheDocument();
    expect(screen.getByText(/Generated .* UTC\+8/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
    // Print hooks: the root, a repeating header, one block per section.
    expect(container.querySelector("[data-report-root]")).not.toBeNull();
    expect(container.querySelector(".report-running")).not.toBeNull();
    expect(container.querySelectorAll(".report-section")).toHaveLength(3);
    expect(container.querySelector("style")?.textContent).toMatch(/@page\s*\{\s*size: A4 portrait;\s*margin: 12mm/);
  });

  it("shows comments with author names only when the answer is not anonymous", () => {
    const rows = db.event_feedback.filter((f) => f.event_id === ev.id);
    const anon = rows.find((f) => f.anonymous && (f.went_well || f.improve));
    expect(anon).toBeTruthy();
    const { container } = eventView("en");
    const nameOf = (id: string) => db.profiles.find((p) => p.id === id)!.name;
    const bylines = [...container.querySelectorAll(".report-comment p:last-child")].map((p) => p.textContent ?? "");
    expect(bylines.some((b) => !b.startsWith("Anonymous"))).toBe(true); // named authors show
    expect(bylines.some((b) => b.startsWith("Anonymous"))).toBe(true);
    const anonName = nameOf(anon!.profile_id);
    // The anonymous author's name appears nowhere unless that same person also wrote a named answer on this event.
    if (!rows.some((f) => !f.anonymous && f.profile_id === anon!.profile_id)) {
      expect(container.textContent).not.toContain(anonName.en);
      expect(container.textContent).not.toContain(anonName.mn);
    }
    expect(screen.getAllByText(/Anonymous/).length).toBeGreaterThan(0);
  });

  it("an event with no feedback shows the mascot empty state instead of empty charts", () => {
    const quiet = { ...db, event_feedback: db.event_feedback.filter((f) => f.event_id !== ev.id) };
    const { container } = eventView("en", ev, quiet);
    expect(screen.getByText("No feedback yet")).toBeInTheDocument();
    expect(screen.queryAllByRole("figure")).toHaveLength(5);
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("Mongolian renders the same sections", () => {
    const { container } = eventView("mn");
    expect(screen.getByRole("heading", { level: 2, name: "Товч дүн" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PDF татах" })).toBeInTheDocument();
    expect(screen.getAllByRole("figure")).toHaveLength(7);
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe("period report", () => {
  const range = semesterRange(semesterOf(NOW));
  const view = (r = range, lang: "en" | "mn" = "en") => render(<PeriodReportView report={periodReport(db, r, NOW)} db={db} now={NOW} lang={lang} />);

  it("renders KPIs, the events table linking to each event report, comparison and retention", () => {
    const { container } = view();
    for (const h of ["At a glance", "Events", "Semester comparison", "People and polls"]) expect(screen.getByRole("heading", { level: 2, name: h })).toBeInTheDocument();
    for (const k of ["Events", "Unique attendees", "Show rate", "New members", "Average rating", "NPS"]) expect(screen.getAllByText(k, { selector: "p" }).length).toBeGreaterThan(0);
    const links = screen.getAllByRole("link", { name: /^Report: / });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l.getAttribute("href")).toMatch(/^\/en\/admin\/events\/[^/]+\/report$/);
    expect(screen.getByRole("table", { name: "Semester comparison" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-chart-image]").length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("an empty range shows empty states with the mascot and never NaN", () => {
    const { container } = view({ from: "2001-03-01", to: "2001-03-01" });
    expect(screen.getByText("No completed events in this range")).toBeInTheDocument();
    expect(screen.getByText("No closed polls in this range")).toBeInTheDocument();
    expect(screen.getAllByText("n/a").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("includes poll turnout for closed polls in range", () => {
    view({ from: "2026-09-01", to: "2026-12-31" });
    const polls = periodReport(db, { from: "2026-09-01", to: "2026-12-31" }, NOW).polls;
    if (polls.length) expect(screen.getByRole("table", { name: "Turnout of closed polls" })).toBeInTheDocument();
  });
});

describe("ReportProvider", () => {
  it("sets the document title (the suggested PDF name) and prints in light colours, then restores the theme", () => {
    const before = document.title;
    const { unmount, container } = render(<div className="ops" data-theme="dark"><ReportProvider lang="en" name="x" title="Hackum report — Pitch Night"><p>hi</p></ReportProvider></div>);
    expect(document.title).toBe("Hackum report — Pitch Night");
    const root = container.querySelector<HTMLElement>(".ops")!;
    act(() => { window.dispatchEvent(new Event("beforeprint")); });
    expect(root.dataset.theme).toBe("light");
    act(() => { window.dispatchEvent(new Event("afterprint")); });
    expect(root.dataset.theme).toBe("dark");
    unmount();
    expect(document.title).toBe(before);
  });
});
