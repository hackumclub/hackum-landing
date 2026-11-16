import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copy, ordinal } from "@/i18n/areas/public";
import type { PanelProps } from "@/components/public/RsvpPanel";

const rsvp = vi.fn();
const cancelRsvp = vi.fn();
vi.mock("@/lib/me/actions", () => ({ rsvp: (...a: unknown[]) => rsvp(...a), cancelRsvp: (...a: unknown[]) => cancelRsvp(...a) }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { default: RsvpPanel } = await import("@/components/public/RsvpPanel");
const c = copy.en.rsvp;
const links = { signIn: "/en/sign-in?next=%2Fen%2Fevents%2Fx", onboarding: "/en/me/onboarding", myEvents: "/en/me/events", apply: "/en/me/events/x/apply", join: "/en/join", membership: "/en/me/membership", browse: "/en/events", ics: "/api/events/x/ics" };
const base = (over: Partial<PanelProps>): PanelProps => ({
  copy: c, eventId: "e1", name: "Knowledge Day", scope: "all", lang: "en", view: { kind: "rsvp", waitlist: false }, seats: { going: 10, waitlisted: 0, capacity: 60, left: 50, full: false },
  dates: {}, attendees: { shown: [], more: 0 }, ordinal: "", links, ...over,
});
beforeEach(() => { rsvp.mockReset(); cancelRsvp.mockReset(); refresh.mockReset(); });

describe("RsvpPanel states", () => {
  it("full event with a waitlist offers the waitlist, not a plain RSVP", () => {
    render(<RsvpPanel {...base({ view: { kind: "rsvp", waitlist: true }, seats: { going: 60, waitlisted: 4, capacity: 60, left: 0, full: true } })} />);
    expect(screen.getByRole("button", { name: c.joinWaitlist })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.rsvp })).not.toBeInTheDocument();
    expect(screen.getByText("Full (60 seats)")).toBeInTheDocument();
    expect(screen.getByText("4 on the waitlist")).toBeInTheDocument();
  });

  it("waitlisted shows the place in line", () => {
    render(<RsvpPanel {...base({ view: { kind: "waitlisted", position: 3 }, ordinal: ordinal("en", 3) })} />);
    expect(screen.getByText("3rd in line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: c.cancelRsvp })).toBeInTheDocument();
  });

  it("applied/rejected link to My events; application events show Apply with the decision date and no RSVP button", () => {
    const { rerender } = render(<RsvpPanel {...base({ view: { kind: "applied" } })} />);
    expect(screen.getByRole("link", { name: c.seeMyEvents })).toHaveAttribute("href", "/en/me/events");
    rerender(<RsvpPanel {...base({ view: { kind: "apply", decisionDeadline: "2026-12-01T00:00:00Z" }, dates: { decisionBy: "December 1" } })} />);
    expect(screen.getByRole("link", { name: c.apply })).toHaveAttribute("href", "/en/me/events/x/apply");
    expect(screen.getByText("We’ll send decisions by December 1.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["invite", c.invite], ["full", c.full], ["closed", c.closed], ["members", c.members], ["alumni", c.alumni],
  ] as const)("blocked (%s) says why and has no RSVP button", (reason, text) => {
    render(<RsvpPanel {...base({ view: { kind: "blocked", reason } })} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("registration not open yet names the date", () => {
    render(<RsvpPanel {...base({ view: { kind: "blocked", reason: "not_open", opensAt: "x" }, dates: { opensAt: "Dec 3, 09:00" } })} />);
    expect(screen.getByText("Registration opens Dec 3, 09:00.")).toBeInTheDocument();
  });

  it("going: calendar links, online link only when provided, and the avatar row counts the rest", () => {
    render(<RsvpPanel {...base({ view: { kind: "going" }, links: { ...links, google: "https://calendar.google.com/x", online: "https://meet.example.com/a" }, attendees: { shown: [{ id: "1", name: "Bat Dorj" }, { id: "2", name: "Nomin Erdene" }], more: 7 } })} />);
    expect(screen.getByRole("link", { name: c.ics })).toHaveAttribute("href", "/api/events/x/ics");
    expect(screen.getByRole("link", { name: c.google })).toHaveAttribute("href", "https://calendar.google.com/x");
    expect(screen.getByRole("link", { name: c.joinOnline })).toHaveAttribute("href", "https://meet.example.com/a");
    expect(screen.getByRole("group", { name: "Going: Bat Dorj, Nomin Erdene +7" })).toBeInTheDocument();
  });
});

describe("RsvpPanel actions", () => {
  it("shows the optimistic state while saving, then reports success", async () => {
    let done: (v: unknown) => void = () => {};
    rsvp.mockReturnValue(new Promise((r) => { done = r; }));
    render(<RsvpPanel {...base({})} />);
    await userEvent.click(screen.getByRole("button", { name: c.rsvp }));
    expect(await screen.findByText(c.going)).toBeInTheDocument(); // optimistic
    expect(rsvp).toHaveBeenCalledWith("e1");
    done({ ok: true, data: { status: "going" } });
  });

  it.each(["unauthenticated", "forbidden", "not_found", "invalid", "conflict", "full", "closed", "rate_limited", "server"] as const)("maps error %s to its own message and reverts", async (code) => {
    rsvp.mockResolvedValue({ ok: false, error: code });
    render(<RsvpPanel {...base({})} />);
    await userEvent.click(screen.getByRole("button", { name: c.rsvp }));
    expect(await screen.findByRole("alert")).toHaveTextContent(c.errors[code]);
    await waitFor(() => expect(screen.getByRole("button", { name: c.rsvp })).toBeInTheDocument());
    expect(refresh).toHaveBeenCalled();
  });

  it("every ErrorCode has a distinct message in both languages", () => {
    for (const lang of ["mn", "en"] as const) {
      const msgs = Object.values(copy[lang].rsvp.errors);
      expect(msgs).toHaveLength(9);
      expect(new Set(msgs).size).toBe(9);
    }
  });

  it("cancel asks first, names the event, and Keep my seat does nothing", async () => {
    render(<RsvpPanel {...base({ view: { kind: "going" } })} />);
    await userEvent.click(screen.getByRole("button", { name: c.cancelRsvp }));
    expect(screen.getByText("Cancel your RSVP for “Knowledge Day”?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: c.cancelKeep }));
    expect(cancelRsvp).not.toHaveBeenCalled();
    expect(screen.getByText(c.going)).toBeInTheDocument();
  });

  it("confirming the cancel calls the action and optimistically offers RSVP again", async () => {
    cancelRsvp.mockReturnValue(new Promise(() => {})); // stays pending: the optimistic state is what we look at
    render(<RsvpPanel {...base({ view: { kind: "going" } })} />);
    await userEvent.click(screen.getByRole("button", { name: c.cancelRsvp }));
    await userEvent.click(screen.getByRole("button", { name: c.cancelConfirm }));
    expect(cancelRsvp).toHaveBeenCalledWith("e1");
    expect(await screen.findByRole("button", { name: c.saving })).toBeDisabled();
  });
});

describe("ordinal", () => {
  it("English 1st/2nd/3rd/4th/11th/12th/13th/21st/22nd; Mongolian n-р", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map((n) => ordinal("en", n))).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "103rd"]);
    expect(ordinal("mn", 3)).toBe("3-р");
  });
});

describe("RsvpPanel: who may register (F-12)", () => {
  it("a student from another school on a members-only event reads 'NUM students only' with links to the membership explanation and open events, never to /join", () => {
    render(<RsvpPanel {...base({ view: { kind: "blocked", reason: "members", numOnly: true } })} />);
    expect(screen.getByText(c.numOnly)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: c.numOnlyMembership })).toHaveAttribute("href", "/en/me/membership");
    expect(screen.getByRole("link", { name: c.browseOpen })).toHaveAttribute("href", "/en/events");
    expect(screen.queryByRole("link", { name: c.membersCta })).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("a NUM-only event for another school's student says the same, without a dead end", () => {
    render(<RsvpPanel {...base({ view: { kind: "blocked", reason: "school" }, scope: "num" })} />);
    expect(screen.getByText(c.numOnly)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: c.browseOpen })).toBeInTheDocument();
  });
  it("a NUM guest on a members-only event is sent to the membership page to apply (not the newsletter)", () => {
    render(<RsvpPanel {...base({ view: { kind: "blocked", reason: "members" } })} />);
    expect(screen.getByText(c.members)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: c.membersCta })).toHaveAttribute("href", "/en/me/membership");
  });
  it("signed out: sign in first, create account second", () => {
    render(<RsvpPanel {...base({ view: { kind: "signed_out", apply: false } })} />);
    expect(screen.getByRole("link", { name: c.signInRsvp })).toHaveAttribute("href", links.signIn);
    expect(screen.getByRole("link", { name: c.createAccountCta })).toHaveAttribute("href", "/en/join");
  });
  it("shows the school scope as a tag", () => {
    const { rerender } = render(<RsvpPanel {...base({ scope: "num" })} />);
    expect(screen.getByText("МУИС")).toBeInTheDocument();
    rerender(<RsvpPanel {...base({ scope: "all" })} />);
    expect(screen.getByText("All schools")).toBeInTheDocument();
  });
});
