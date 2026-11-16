import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/me";
import type { EventCardVm } from "@/lib/me/queries";

vi.mock("@/lib/me/actions", () => ({ rsvp: vi.fn(), cancelRsvp: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/me/Toast", () => ({ useToast: () => vi.fn() }));
const { default: EventCard } = await import("@/components/me/EventCard");
const { default: ApplicationStatus } = await import("@/components/me/ApplicationStatus");

const base: EventCardVm = {
  id: "e1", slug: "meetup", kind: "meetup", title: { mn: "Уулзалт", en: "Weekly Meetup" }, tagline: { mn: "", en: "" },
  starts_at: "2026-12-01T10:00:00Z", ends_at: "2026-12-01T12:00:00Z", approximate: false, cover: null, mode: "offline", venue: "NUM 114", onlineUrl: null,
  regMode: "rsvp", audience: "open", schoolScope: "all", cancelled: false, capacity: null, going: 0, seatsLeft: null, decisionDeadline: null, teamMode: "none",
  live: false, over: false, reg: null, elig: { ok: true, waitlist: false },
};
const d = getDictionary("en");
const c = copy.en;
const card = (vm: Partial<EventCardVm>, mode: "upcoming" | "going" = "upcoming") => render(<EventCard vm={{ ...base, ...vm }} lang="en" d={d} c={c} mode={mode} />);

describe("member event card", () => {
  it("the RSVP action reads \"I'm going\" (Going stays a state label)", () => {
    card({});
    expect(screen.getByRole("button", { name: "I'm going" })).toBeEnabled();
    expect(copy.mn.event.rsvp).toBe("Ирнэ");
  });
  it("a NUM-only event wears the МУИС tag", () => {
    card({ schoolScope: "num" });
    expect(screen.getByText("МУИС")).toBeInTheDocument();
  });
  it("is locked for another school: reason in words, a link to open events, no dead disabled button", () => {
    card({ schoolScope: "num", elig: { ok: false, reason: "school" } });
    expect(screen.getByText("This event is for NUM students")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse open events" })).toHaveAttribute("href", "/en/me/events?tab=upcoming&show=open");
    expect(screen.queryByRole("button", { name: /going/i })).toBeNull();
  });
  it("an accepted applicant sees Accepted and the action Can't come (not Going / Cancel RSVP)", () => {
    card({ regMode: "application", reg: { status: "going", teamId: null, waitPos: null } }, "going");
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Can't come" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel RSVP" })).toBeNull();
  });
  it("an RSVP going keeps Going and Cancel RSVP", () => {
    card({ reg: { status: "going", teamId: null, waitPos: null } }, "going");
    expect(screen.getByText("Going")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel RSVP" })).toBeInTheDocument();
  });
  it("shows the whole poster (object-contain) and keeps every badge off the artwork", () => {
    const { container } = card({ cover: "/img/posters/tetris.jpg", reg: { status: "going", teamId: null, waitPos: null }, schoolScope: "num" }, "going");
    const slot = container.querySelector("[data-poster]")!;
    const img = slot.querySelector("img[data-poster-img]")!;
    expect(img.className).toContain("object-contain");
    expect(img.className).not.toContain("object-cover");
    // Pills, tags and the date tile live in the text column, never inside the poster slot.
    expect(slot.textContent).toBe("");
    expect(container.querySelector("article")!.textContent).toContain("Going");
  });
  it("Cancel RSVP is a quiet one-line text button, Calendar and Directions are soft pills", () => {
    card({ venue: "NUM 114", reg: { status: "going", teamId: null, waitPos: null } }, "going");
    const cancel = screen.getByRole("button", { name: "Cancel RSVP" });
    expect(cancel.className).toContain("whitespace-nowrap");
    expect(cancel.className).toContain("text-danger-fg");
    expect(cancel.className).not.toContain("border");
    expect(screen.getByRole("link", { name: "Calendar" }).className).toContain("border-line ");
    expect(screen.getByRole("link", { name: "Directions" })).toBeInTheDocument();
  });
  it("the title link is a 44 px target", () => {
    card({});
    expect(screen.getByRole("link", { name: "Weekly Meetup" }).className).toContain("min-h-11");
  });
});

describe("application status page", () => {
  it("shows Accepted and Can't come for an accepted applicant", () => {
    render(<ApplicationStatus vm={{ ...base, regMode: "application", reg: { status: "going", teamId: null, waitPos: null } }} lang="en" d={d} c={c} deadline={null} team={null} teamMax={1} />);
    expect(screen.getAllByText("Accepted").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Can't come" })).toBeInTheDocument();
  });
});
