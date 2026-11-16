import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Clock, Mail } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { StickyBar, Timeline } from "@/components/me/parts";

// EventCard pulls in the Server Actions (server-only); the pure parts under test never call them.
vi.mock("@/lib/me/actions", () => ({ rsvp: vi.fn(), cancelRsvp: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { chipParts, SeatsBar } = await import("@/components/me/EventCard");

describe("date chip over the poster", () => {
  it("uses the Ulaanbaatar calendar day, not the browser's (late evening UTC is already tomorrow in UB)", () => {
    // 17:00 UTC on Nov 20 = 01:00 on Nov 21 in UB (TZ is forced to New York in vitest).
    expect(chipParts({ starts_at: "2026-11-20T17:00:00Z", approximate: false }, "en")).toEqual({ month: "Nov", day: "21" });
    expect(chipParts({ starts_at: "2026-11-20T10:30:00Z", approximate: false }, "en").day).toBe("20");
  });
  it("an approximate date shows the month and a two-digit year, never an invented day", () => {
    const chip = chipParts({ starts_at: "2027-01-15T00:00:00Z", approximate: true }, "en");
    expect(chip).toEqual({ month: "Jan", day: "27" });
  });
});

describe("SeatsBar", () => {
  const c = copy.en;
  it("shows going / capacity and the seats left, as a meter", () => {
    render(<SeatsBar vm={{ capacity: 60, going: 52, seatsLeft: 8 }} lang="en" c={c} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "52");
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuemax", "60");
    expect(screen.getByText("52 of 60 going")).toBeInTheDocument();
    expect(screen.getByText("8 seats left")).toBeInTheDocument();
  });
  it("says Full at zero left, and renders nothing for unlimited events", () => {
    const { container, rerender } = render(<SeatsBar vm={{ capacity: 40, going: 40, seatsLeft: 0 }} lang="en" c={c} />);
    expect(screen.getByText("Full")).toBeInTheDocument();
    rerender(<SeatsBar vm={{ capacity: null, going: 12, seatsLeft: null }} lang="en" c={c} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Timeline and StickyBar", () => {
  it("marks the current step for assistive tech", () => {
    render(<Timeline label="Next" items={[{ state: "done", icon: Mail, title: "Sent" }, { state: "current", icon: Clock, title: "Review", line: "By Friday" }, { state: "todo", icon: Mail, title: "Email" }]} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });
  it("is a labelled group that is lifted above the tab bar only when asked", () => {
    const { rerender } = render(<StickyBar label="Apply">x</StickyBar>);
    expect(screen.getByRole("group", { name: "Apply" }).className).toContain("bottom-0");
    rerender(<StickyBar aboveTabs label="Apply">x</StickyBar>);
    expect(screen.getByRole("group", { name: "Apply" }).className).toContain("5.25rem");
  });
});
