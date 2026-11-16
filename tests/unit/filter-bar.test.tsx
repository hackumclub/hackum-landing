import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterBar, { FilterChips } from "@/components/ui/FilterBar";

describe("FilterBar", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const base = { onClear: () => {}, activeCount: 0 };

  it("debounces search by 250ms by default and emits only the last value", () => {
    const onChange = vi.fn();
    render(<FilterBar {...base} search={{ value: "", onChange, placeholder: "Search events", label: "Search events" }} />);
    const input = screen.getByRole("searchbox", { name: "Search events" });
    fireEvent.change(input, { target: { value: "h" } });
    fireEvent.change(input, { target: { value: "ha" } });
    fireEvent.change(input, { target: { value: "hack" } });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(249); });
    expect(onChange).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("hack");
  });
  it("honours debounceMs", () => {
    const onChange = vi.fn();
    render(<FilterBar {...base} debounceMs={0} search={{ value: "", onChange, placeholder: "s", label: "Search" }} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "x" } });
    act(() => { vi.advanceTimersByTime(1); });
    expect(onChange).toHaveBeenCalledWith("x");
  });
  it("shows Clear filters only when something is active, and calls onClear", async () => {
    const onClear = vi.fn();
    const { rerender } = render(<FilterBar onClear={onClear} activeCount={0} chips={<span>chips</span>} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    rerender(<FilterBar onClear={onClear} activeCount={2} chips={<span>chips</span>} />);
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
  it("folds chips and the date range behind the Filters disclosure on phones", () => {
    render(<FilterBar onClear={() => {}} activeCount={1} chips={<span>chip-slot</span>} dateRange={<span>date-slot</span>} />);
    const toggle = screen.getByRole("button", { name: /Filters/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("chip-slot")).toBeInTheDocument();
    expect(screen.getByText("date-slot")).toBeInTheDocument();
  });
  it("resyncs the search box when the controlled value is reset from outside", () => {
    const { rerender } = render(<FilterBar {...base} search={{ value: "abc", onChange: () => {}, placeholder: "s", label: "Search" }} />);
    expect(screen.getByRole("searchbox")).toHaveValue("abc");
    rerender(<FilterBar {...base} search={{ value: "", onChange: () => {}, placeholder: "s", label: "Search" }} />);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});

describe("FilterChips (and the legacy FilterBar props)", () => {
  it("toggles options with aria-pressed", async () => {
    const onChange = vi.fn();
    render(<FilterChips label="Kind" options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} value={["a"]} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "A" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });
  it("FilterBar still renders chips when given the legacy options API", () => {
    render(<FilterBar label="Kind" options={[{ value: "a", label: "A" }]} value={[]} onChange={() => {}} />);
    expect(screen.getByRole("group", { name: "Kind" })).toBeInTheDocument();
  });
});
