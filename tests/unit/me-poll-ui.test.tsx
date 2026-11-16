import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PollCardVm } from "@/lib/me/poll-view";

const vote = vi.fn();
vi.mock("@/lib/me/poll-actions", () => ({ votePollAction: (...a: unknown[]) => vote(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { default: PollCard } = await import("@/components/me/polls/PollCard");

const opt = (id: string, en: string) => ({ id, label: { mn: en, en } });
const base = (over: Partial<PollCardVm> = {}): PollCardVm => ({
  id: "poll_1", title: { mn: "Сэдэв", en: "What next?" }, description: { mn: "", en: "Pick up to two." }, audience: "members", anonymous: true, multi: true, maxChoices: 2,
  results: "after_vote", state: "open", opensAt: null, closesAt: null, options: [opt("rag", "RAG"), opt("web", "Web"), opt("sec", "Security"), opt("cv", "Vision")],
  myVote: null, visible: false, hidden: "after_vote", tallies: null, voters: 10, eligible: 20, turnout: 0.5, ...over,
});

beforeEach(() => { vote.mockReset(); vote.mockResolvedValue({ ok: true, data: undefined }); });

describe("multi-choice limit", () => {
  it("disables the unchecked boxes once the limit is reached and says why; freeing one re-enables them", async () => {
    const user = userEvent.setup();
    render(<PollCard vm={base()} lang="en" timeLine="Closes in 5 days" />);
    expect(screen.getByText("Choose up to 2")).toBeInTheDocument();
    const [rag, web, sec, cv] = ["RAG", "Web", "Security", "Vision"].map((n) => screen.getByRole("checkbox", { name: n }));
    await user.click(rag); await user.click(web);
    expect(rag).toBeChecked(); expect(web).toBeChecked();
    expect(sec).toBeDisabled(); expect(cv).toBeDisabled();
    expect(screen.getByText("You chose 2. Untick one to pick another.")).toBeInTheDocument();
    expect(sec).toHaveAccessibleDescription("You chose 2. Untick one to pick another.");
    await user.click(web);
    expect(sec).toBeEnabled(); expect(cv).toBeEnabled();
    expect(screen.queryByText(/Untick one/)).not.toBeInTheDocument();
  });

  it("sends exactly the chosen options and thanks with the saved state (the Vote button is off until something is chosen)", async () => {
    const user = userEvent.setup();
    render(<PollCard vm={base()} lang="en" timeLine="x" />);
    const submit = screen.getByRole("button", { name: "Vote" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Security" }));
    await user.click(screen.getByRole("checkbox", { name: "Vision" }));
    await user.click(submit);
    expect(vote).toHaveBeenCalledWith("en", { pollId: "poll_1", optionIds: ["sec", "cv"] });
    await waitFor(() => expect(screen.getByText("Your vote is in. Results appear when the poll closes.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Change my vote" })).toBeInTheDocument();
  });

  it("shows the server's sentence when the vote is refused and keeps the form", async () => {
    vote.mockResolvedValue({ ok: false, error: "closed", message: "This poll is closed" });
    const user = userEvent.setup();
    render(<PollCard vm={base()} lang="en" timeLine="x" />);
    await user.click(screen.getByRole("checkbox", { name: "RAG" }));
    await user.click(screen.getByRole("button", { name: "Vote" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This poll is closed");
    expect(screen.getByRole("checkbox", { name: "RAG" })).toBeChecked();
  });
});

describe("single choice", () => {
  it("is a radio group and choosing another option replaces the first", async () => {
    const user = userEvent.setup();
    render(<PollCard vm={base({ multi: false, maxChoices: 1 })} lang="en" timeLine="x" />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getByText("Choose one")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "RAG" }));
    await user.click(screen.getByRole("radio", { name: "Web" }));
    expect(screen.getByRole("radio", { name: "RAG" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Web" })).toBeChecked();
  });
});

describe("results", () => {
  const voted = base({ myVote: ["web"], visible: true, hidden: null, tallies: [{ option_id: "rag", votes: 5 }, { option_id: "web", votes: 3 }, { option_id: "sec", votes: 0 }, { option_id: "cv", votes: 2 }] });
  it("shows counts and percent as text, tags your vote, the turnout and the anonymity note", () => {
    render(<PollCard vm={voted} lang="en" timeLine="x" />);
    expect(screen.getByText("5 votes · 50%")).toBeInTheDocument();
    expect(screen.getByText("3 votes · 30%")).toBeInTheDocument();
    expect(screen.getByText("0 votes · 0%")).toBeInTheDocument();
    expect(screen.getByText("Your vote")).toBeInTheDocument();
    expect(screen.getByText("10 of 20 voted")).toBeInTheDocument();
    expect(screen.getByText("Your vote is anonymous.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("Change my vote brings back the form with the current vote ticked, Cancel returns to the results", async () => {
    const user = userEvent.setup();
    render(<PollCard vm={voted} lang="en" timeLine="x" />);
    await user.click(screen.getByRole("button", { name: "Change my vote" }));
    expect(screen.getByRole("checkbox", { name: "Web" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("3 votes · 30%")).toBeInTheDocument();
  });

  it("explains when hidden results will appear and never invents numbers", () => {
    const { rerender } = render(<PollCard vm={base()} lang="en" timeLine="x" />);
    expect(screen.getByText("Results appear after you vote")).toBeInTheDocument();
    rerender(<PollCard key="b" vm={base({ myVote: ["rag"], hidden: "after_close", results: "after_close" })} lang="en" timeLine="x" />);
    expect(screen.getByText("Your vote is in. Results appear when the poll closes.")).toBeInTheDocument();
    rerender(<PollCard key="c" vm={base({ myVote: ["rag"], hidden: "staff_only", results: "staff_only" })} lang="en" timeLine="x" />);
    expect(screen.getByText("Your vote is in. Only organizers see results.")).toBeInTheDocument();
    expect(screen.queryByText(/votes ·/)).not.toBeInTheDocument();
  });

  it("a closed poll has no voting UI; a non-anonymous poll says organizers can see the choice", () => {
    render(<PollCard vm={base({ state: "closed", anonymous: false, myVote: ["rag"], visible: true, hidden: null, tallies: [{ option_id: "rag", votes: 1 }, { option_id: "web", votes: 0 }, { option_id: "sec", votes: 0 }, { option_id: "cv", votes: 0 }], voters: 1 })} lang="en" timeLine="Closed Nov 9" />);
    expect(screen.queryByRole("button", { name: /vote/i })).not.toBeInTheDocument();
    expect(screen.getByText("Closed Nov 9")).toBeInTheDocument();
    expect(screen.getByText(/not anonymous: organizers can see how you voted/)).toBeInTheDocument();
  });
});
