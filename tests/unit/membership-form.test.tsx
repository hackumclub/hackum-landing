import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { copy } from "@/i18n/areas/me";
import type { Question } from "@/lib/events/questions";

const apply = vi.fn();
vi.mock("@/lib/me/actions", () => ({ applyForMembershipAction: (...a: unknown[]) => apply(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/me/Toast", () => ({ useToast: () => vi.fn() }));
const { default: MembershipForm } = await import("@/components/me/MembershipForm");

const c = copy.en.membership;
const questions: Question[] = [{ id: "lang", type: "short", required: true, label: { mn: "Дуртай хэл", en: "Favourite language?" } }];
const motivation = "I want to build things with this club.";
beforeEach(() => apply.mockReset());

describe("MembershipForm renders the club's own questions", () => {
  it("blocks the submit with an error beside the missing required answer, and sends nothing", async () => {
    const user = userEvent.setup();
    render(<MembershipForm c={c} errors={c.err} lang="en" questions={questions} />);
    await user.type(screen.getByLabelText(/Why do you want to join/), motivation);
    await user.click(screen.getByRole("button", { name: c.submit }));
    expect(apply).not.toHaveBeenCalled();
    const field = screen.getByLabelText(/Favourite language/);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(/fill in this field/i);
  });
  it("sends the answers together with the motivation and teams", async () => {
    const user = userEvent.setup();
    apply.mockResolvedValue({ ok: true, data: { id: "a1" } });
    render(<MembershipForm c={c} errors={c.err} lang="en" questions={questions} />);
    await user.type(screen.getByLabelText(/Why do you want to join/), motivation);
    await user.type(screen.getByLabelText(/Favourite language/), "Go");
    await user.click(screen.getByRole("button", { name: c.submit }));
    await waitFor(() => expect(apply).toHaveBeenCalledWith({ motivation, team_interest: [], answers: { lang: "Go" } }));
  });
  it("shows the server's per-question errors beside the field", async () => {
    const user = userEvent.setup();
    apply.mockResolvedValue({ ok: false, error: "invalid", fields: { lang: "too_long" } });
    render(<MembershipForm c={c} errors={c.err} lang="en" questions={questions} />);
    await user.type(screen.getByLabelText(/Why do you want to join/), motivation);
    await user.type(screen.getByLabelText(/Favourite language/), "Go");
    await user.click(screen.getByRole("button", { name: c.submit }));
    await waitFor(() => expect(screen.getByLabelText(/Favourite language/)).toHaveAttribute("aria-invalid", "true"));
  });
  it("renders no extra fields when the club asks nothing", () => {
    render(<MembershipForm c={c} errors={c.err} lang="en" questions={[]} />);
    expect(screen.queryByLabelText(/Favourite language/)).toBeNull();
  });
});
