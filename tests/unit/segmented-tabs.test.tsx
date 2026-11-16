import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import SegmentedTabs from "@/components/ui/SegmentedTabs";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/admin/events/b" }));

const ITEMS = [
  { key: "a", label: "Overview" },
  { key: "b", label: "Guests", count: 120 },
  { key: "c", label: "Emails" },
];

function Harness({ onChange }: { onChange?: (k: string) => void }) {
  const [v, setV] = useState("a");
  return <SegmentedTabs items={ITEMS} value={v} onChange={(k) => { setV(k); onChange?.(k); }} ariaLabel="Sections" />;
}

describe("SegmentedTabs (in-page)", () => {
  it("marks the selected tab, uses a roving tabindex and shows counts through CountBadge", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Guests/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Guests/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByLabelText("120")).toBeInTheDocument();
  });
  it("moves the selection with ArrowRight/ArrowLeft (wrapping), Home and End, and moves focus with it", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole("tab", { name: "Overview" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Guests/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Guests/ })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Emails" })).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Emails" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    expect(onChange).toHaveBeenLastCalledWith("a");
  });
  it("selects on click", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "Emails" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });
});

describe("SegmentedTabs (routed)", () => {
  const hrefs = { a: "/en/admin/events/a", b: "/en/admin/events/b", c: "/en/admin/events/c" };
  it("renders links, with aria-current=page on the tab whose href is the current path", () => {
    render(<SegmentedTabs items={ITEMS} hrefs={hrefs} ariaLabel="Sections" />);
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Guests/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Emails" })).toHaveAttribute("href", "/en/admin/events/c");
  });
  it("moves focus (not navigation) with the arrow keys", async () => {
    render(<SegmentedTabs items={ITEMS} hrefs={hrefs} ariaLabel="Sections" />);
    screen.getByRole("link", { name: /Guests/ }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("link", { name: "Emails" })).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveFocus();
  });
});
