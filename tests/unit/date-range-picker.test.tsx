import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { presetRange } from "@/lib/date-range";

// 2026-11-16 12:00 UB
const NOW = new Date("2026-11-16T04:00:00Z");

describe("presetRange", () => {
  it("resolves the four presets on the UB calendar", () => {
    expect(presetRange("thisSemester", NOW)).toEqual({ from: "2026-09-01", to: "2026-12-31" });
    expect(presetRange("lastSemester", NOW)).toEqual({ from: "2026-01-01", to: "2026-08-31" });
    expect(presetRange("last30", NOW)).toEqual({ from: "2026-10-18", to: "2026-11-16" });
    expect(presetRange("thisYear", NOW)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("uses the UB date, not the UTC date, near midnight", () => {
    // 2026-12-31 20:00 UTC is already 2027-01-01 04:00 in UB
    const now = new Date("2026-12-31T20:00:00Z");
    expect(presetRange("thisYear", now)).toEqual({ from: "2027-01-01", to: "2027-12-31" });
    expect(presetRange("thisSemester", now)).toEqual({ from: "2027-01-01", to: "2027-08-31" });
    expect(presetRange("last30", now).to).toBe("2027-01-01");
  });
});

describe("DateRangePicker", () => {
  const open = async () => userEvent.click(screen.getByRole("button", { name: /date range/i }));

  it("emits the semester range when 'This semester' is chosen", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={null} onChange={onChange} presets={["thisSemester", "lastSemester", "last30", "thisYear"]} lang="en" now={NOW} />);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "This semester" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-09-01", to: "2026-12-31" });
  });
  it("emits last 30 days and previous semester", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={null} onChange={onChange} presets={["lastSemester", "last30"]} lang="en" now={NOW} />);
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Last semester" }));
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-01-01", to: "2026-08-31" });
    await open();
    await userEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    expect(onChange).toHaveBeenLastCalledWith({ from: "2026-10-18", to: "2026-11-16" });
  });
  it("applies a custom range and refuses from > to with an inline error", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={null} onChange={onChange} presets={["last30"]} lang="en" now={NOW} />);
    await open();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-11-20" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-10" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/before/i);
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-11-25" } });
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onChange).toHaveBeenCalledWith({ from: "2026-11-20", to: "2026-11-25" });
  });
  it("shows the active range on the trigger and clears it", async () => {
    const onChange = vi.fn();
    render(<DateRangePicker value={{ from: "2026-09-01", to: "2026-12-31" }} onChange={onChange} presets={["thisSemester"]} lang="en" now={NOW} />);
    expect(screen.getByRole("button", { name: /^date range/i })).toHaveTextContent("Sep 1");
    await userEvent.click(screen.getByRole("button", { name: "Clear date range" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
