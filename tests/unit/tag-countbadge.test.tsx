import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import Tag from "@/components/ui/Tag";
import CountBadge from "@/components/ui/CountBadge";

describe("CountBadge", () => {
  it("caps the visible text at 99+ but keeps the exact count as the accessible name", () => {
    render(<CountBadge n={120} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(screen.getByLabelText("120")).toBeInTheDocument();
  });
  it("shows the exact count below the cap and honours a custom max", () => {
    const { rerender } = render(<CountBadge n={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByLabelText("7")).toBeInTheDocument();
    rerender(<CountBadge n={12} max={9} />);
    expect(screen.getByText("9+")).toBeInTheDocument();
    expect(screen.getByLabelText("12")).toBeInTheDocument();
  });
  it("clamps negative or fractional counts to a whole non-negative number", () => {
    render(<CountBadge n={-3.4} />);
    expect(screen.getByLabelText("0")).toBeInTheDocument();
  });
});

describe("Tag", () => {
  it("always renders its text and defaults to the neutral tone with a pill shape", () => {
    render(<Tag>Hackathon</Tag>);
    const el = screen.getByText("Hackathon");
    expect(el.closest("span")?.className).toContain("rounded-full");
    expect(el.closest("span")?.className).toContain("bg-neutral-soft");
  });
  it("applies tone classes and renders an aria-hidden 16px icon next to the text", () => {
    const { container } = render(<Tag tone="ok" icon={Check}>Open</Tag>);
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(container.firstElementChild?.className).toContain("bg-ok-soft");
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "16");
  });
});
