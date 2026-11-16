import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CapacityBar from "@/components/ui/CapacityBar";
import FilterBar from "@/components/ui/FilterBar";
import ThemeToggle from "@/components/ui/ThemeToggle";
import OpsRoot from "@/components/ui/OpsRoot";
import { initials } from "@/components/ui/Avatar";

describe("CapacityBar", () => {
  it("exposes a meter with the seat counts", () => {
    render(<CapacityBar value={84} max={120} label="84 of 120 seats taken" />);
    const m = screen.getByRole("meter", { name: "84 of 120 seats taken" });
    expect(m).toHaveAttribute("aria-valuenow", "84");
    expect(m).toHaveAttribute("aria-valuemax", "120");
  });
  it("caps the fill at 100% when over capacity and renders no meter when unlimited", () => {
    const { rerender } = render(<CapacityBar value={130} max={120} label="full" />);
    expect(screen.getByTestId("capacity-fill")).toHaveStyle({ width: "100%" });
    rerender(<CapacityBar value={12} max={null} label="12 going · no limit" />);
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
    expect(screen.getByText("12 going · no limit")).toBeInTheDocument();
  });
});

describe("FilterBar", () => {
  it("toggles chips with aria-pressed and reports the active set", async () => {
    const onChange = vi.fn();
    render(<FilterBar label="Status" options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }]} value={[]} onChange={onChange} />);
    const chip = screen.getByRole("button", { name: "Draft" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(chip);
    expect(onChange).toHaveBeenCalledWith(["draft"]);
  });
});

describe("ThemeToggle", () => {
  it("sets data-theme on the ops root and persists the choice", async () => {
    localStorage.clear();
    const { container } = render(
      <OpsRoot>
        <ThemeToggle labels={{ system: "System theme", light: "Light theme", dark: "Dark theme", group: "Theme" }} />
      </OpsRoot>,
    );
    const root = container.querySelector(".ops")!;
    expect(root).not.toHaveAttribute("data-theme");
    await userEvent.click(screen.getByRole("radio", { name: "Dark theme" }));
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("ops-theme")).toBe("dark");
    await userEvent.click(screen.getByRole("radio", { name: "System theme" }));
    expect(root).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem("ops-theme")).toBeNull();
  });
});

describe("Avatar initials", () => {
  it("takes up to two initials and handles Cyrillic and single names", () => {
    expect(initials("Бат-Эрдэнэ Ганбаатар")).toBe("БГ");
    expect(initials("  saraa ")).toBe("S");
    expect(initials("")).toBe("?");
  });
});

describe("ThemeToggle size", () => {
  it("offers 44px touch targets for the member app", () => {
    const labels = { system: "System theme", light: "Light theme", dark: "Dark theme", group: "Theme" };
    const { container } = render(<OpsRoot><ThemeToggle size="lg" labels={labels} /></OpsRoot>);
    for (const label of container.querySelectorAll("label[title]")) expect(label.className).toContain("size-11");
    expect(container.querySelectorAll("label[title]")).toHaveLength(3);
  });
});
