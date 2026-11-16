import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FilterDisclosure from "@/components/ui/FilterDisclosure";

const content = <div data-testid="chips">chips</div>;

describe("FilterDisclosure (filters fold away on phones)", () => {
  it("starts closed on a phone when no filter is active, and the button says how many are active (none)", () => {
    render(<FilterDisclosure label="Filters" activeCount={0}>{content}</FilterDisclosure>);
    const btn = screen.getByRole("button", { name: "Filters" });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("chips").parentElement!.className).toContain("hidden");
  });
  it("starts open when a filter is already active, with the active count on the button", () => {
    render(<FilterDisclosure label="Filters" activeCount={2}>{content}</FilterDisclosure>);
    const btn = screen.getByRole("button", { name: /Filters/ });
    expect(btn).toHaveAttribute("aria-expanded", "true");
    expect(btn).toHaveTextContent("2");
    expect(screen.getByTestId("chips").parentElement!.className).not.toContain("hidden");
  });
  it("toggles with the button, and the button controls the region it shows", async () => {
    render(<FilterDisclosure label="Filters" activeCount={0}>{content}</FilterDisclosure>);
    const btn = screen.getByRole("button", { name: "Filters" });
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const region = screen.getByTestId("chips").parentElement!;
    expect(btn.getAttribute("aria-controls")).toBe(region.id);
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });
  it("is always open from tablet width up: the button is phone-only and the region is forced visible", () => {
    render(<FilterDisclosure label="Filters" activeCount={0}>{content}</FilterDisclosure>);
    expect(screen.getByRole("button", { name: "Filters" }).className).toContain("md:hidden");
    expect(screen.getByTestId("chips").parentElement!.className).toContain("md:grid");
  });
});
