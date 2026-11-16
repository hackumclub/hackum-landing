import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Calendar from "@/components/ui/Calendar";
import DatePicker from "@/components/ui/DatePicker";
import DateRangePicker from "@/components/ui/DateRangePicker";
import TimeField from "@/components/ui/TimeField";

// 2026-11-16 (a Monday) 12:00 UB
const NOW = new Date("2026-11-16T04:00:00Z");
const day = (iso: string) => document.querySelector<HTMLElement>(`[data-iso="${iso}"]`)!;

describe("Calendar (ARIA grid)", () => {
  it("is a Monday-first grid with a today marker, one tabbable day and aria-selected on the value", () => {
    render(<Calendar lang="en" value="2026-11-20" now={NOW} onPick={() => {}} />);
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]);
    expect(day("2026-11-16")).toHaveAttribute("aria-current", "date");
    expect(day("2026-11-20").closest('[role="gridcell"]')).toHaveAttribute("aria-selected", "true");
    expect(document.querySelectorAll('[data-iso][tabindex="0"]')).toHaveLength(1);
    expect(day("2026-11-20")).toHaveAttribute("tabindex", "0");
  });
  it("moves with arrows, week and month keys and crosses month boundaries", async () => {
    render(<Calendar lang="en" value="2026-11-16" now={NOW} onPick={() => {}} />);
    day("2026-11-16").focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(day("2026-11-17")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(day("2026-11-24")).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(day("2026-11-23")).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(day("2026-11-29")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("grid", { name: "December 2026" })).toBeInTheDocument();
    expect(day("2026-12-01")).toHaveFocus();
    await userEvent.keyboard("{PageUp}");
    expect(screen.getByRole("grid", { name: "November 2026" })).toBeInTheDocument();
    await userEvent.keyboard("{Shift>}{PageDown}{/Shift}");
    expect(screen.getByRole("grid", { name: "November 2027" })).toBeInTheDocument();
  });
  it("picks with Enter and click, but never a day outside min/max", async () => {
    const onPick = vi.fn();
    render(<Calendar lang="en" value="2026-11-16" min="2026-11-10" max="2026-11-20" now={NOW} onPick={onPick} />);
    day("2026-11-16").focus();
    await userEvent.keyboard("{ArrowRight}{Enter}");
    expect(onPick).toHaveBeenLastCalledWith("2026-11-17");
    await userEvent.click(day("2026-11-25"));
    await userEvent.click(day("2026-11-05"));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(day("2026-11-25")).toHaveAttribute("aria-disabled", "true");
  });
  it("tints the days between the ends of a range and speaks Mongolian", () => {
    render(<Calendar lang="mn" range={{ from: "2026-11-10", to: "2026-11-12" }} now={NOW} onPick={() => {}} />);
    expect(screen.getByRole("grid", { name: "2026 оны 11-р сар" })).toBeInTheDocument();
    expect(day("2026-11-11").closest('[role="gridcell"]')!.className).toContain("bg-accent-soft");
    expect(day("2026-11-14").closest('[role="gridcell"]')!.className).not.toContain("bg-accent-soft");
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent("Да");
  });
});

describe("DatePicker", () => {
  it("opens the calendar from the trigger, picks a day and closes", async () => {
    const onChange = vi.fn();
    render(<DatePicker value={null} onChange={onChange} lang="en" now={NOW} />);
    await userEvent.click(screen.getByRole("button", { name: /Pick a date/ }));
    await userEvent.click(day("2026-11-19"));
    expect(onChange).toHaveBeenCalledWith("2026-11-19");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
  it("accepts a typed YYYY-MM-DD, rejects an impossible day inline, and honours min", async () => {
    const onChange = vi.fn();
    render(<DatePicker value={null} onChange={onChange} lang="en" min="2026-11-10" now={NOW} />);
    await userEvent.click(screen.getByRole("button", { name: /Pick a date/ }));
    const box = screen.getByLabelText(/Date \(YYYY-MM-DD\)/);
    await userEvent.type(box, "2026-02-30{Enter}");
    expect(screen.getByRole("alert")).toHaveTextContent("YYYY-MM-DD");
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.clear(box);
    await userEvent.type(box, "2026-11-01{Enter}");
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.clear(box);
    await userEvent.type(box, "2026-11-12{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-11-12");
  });
});

describe("DateRangePicker calendar", () => {
  it("builds a range from two clicks (swapping an earlier second click) and applies it", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={null} onChange={onChange} presets={["last30"]} lang="en" now={NOW} />);
    await userEvent.click(screen.getByRole("button", { name: /date range/i }));
    await userEvent.click(day("2026-11-20"));
    await userEvent.click(day("2026-11-05"));
    expect(screen.getByLabelText("From")).toHaveValue("2026-11-05");
    expect(screen.getByLabelText("To")).toHaveValue("2026-11-20");
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-11-05", to: "2026-11-20" });
  });
  it("asks for both dates when only one day was picked", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={null} onChange={onChange} presets={["last30"]} lang="en" now={NOW} />);
    await userEvent.click(screen.getByRole("button", { name: /date range/i }));
    await userEvent.click(day("2026-11-20"));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/both dates/i);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("TimeField", () => {
  it("commits only a valid HH:mm and steps 15 minutes with the arrows", async () => {
    const onChange = vi.fn();
    render(<TimeField label="Time" value="09:00" onChange={onChange} />);
    const box = screen.getByLabelText("Time");
    await userEvent.clear(box);
    await userEvent.type(box, "25:00");
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(box).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(box);
    await userEvent.type(box, "930");
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith("09:30");
    await userEvent.type(box, "{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith("09:15");
  });
});
