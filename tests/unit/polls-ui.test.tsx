import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeed } from "@/lib/mockdb/seed";
import { pollResults } from "@/lib/mockdb/polls";
import { draftFromPoll } from "@/lib/polls/form";
import { audienceCounts, pollRows } from "@/lib/polls/rows";

const push = vi.fn(), refresh = vi.fn();
const setStatus = vi.fn<(id: string, to: string) => Promise<unknown>>(async () => ({ ok: true as const, data: { notified: 38 } }));
const update = vi.fn<(id: string, input: unknown) => Promise<unknown>>(async () => ({ ok: true as const, data: undefined }));
const create = vi.fn<(input: unknown) => Promise<unknown>>(async () => ({ ok: true as const, data: { id: "poll_new" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace: (u: string) => window.history.replaceState(null, "", u) }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/lib/polls/actions", () => ({
  setPollStatusAction: (id: string, to: string) => setStatus(id, to),
  updatePollAction: (id: string, input: unknown) => update(id, input),
  createPollAction: (input: unknown) => create(input),
}));
const { default: PollResults } = await import("@/components/admin/polls/PollResults");
const { default: PollEditor } = await import("@/components/admin/polls/PollEditor");
const { default: PollStatusActions } = await import("@/components/admin/polls/PollStatusActions");
const { default: PollsList } = await import("@/components/admin/polls/PollsList");

const NOW = new Date("2026-11-16T04:00:00Z");
const db = buildSeed(NOW);
const open = db.polls.find((p) => p.status === "published" && p.anonymous)!;
const closed = db.polls.find((p) => p.status === "closed" && !p.anonymous)!;
const staff = db.staff_roles[0].profile_id;

beforeEach(() => window.history.replaceState(null, "", "/en/admin/polls"));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("PollResults", () => {
  it("anonymous poll: turnout, a bar per option, an export button, and no voter list", () => {
    const view = pollResults(db, open.id, staff, NOW)!;
    const { container } = render(<PollResults view={view} lang="en" />);
    expect(screen.getByText("Turnout")).toBeInTheDocument();
    expect(screen.getByText(`${view.voters} of ${view.eligible} people voted`)).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Votes per option" })).toBeInTheDocument();
    expect(screen.getByText(/Anonymous poll: who voted for what is not shown/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "People who voted" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });
  it("named poll: staff see who voted and what they chose", () => {
    const view = pollResults(db, closed.id, staff, NOW)!;
    expect(view.voterList?.length).toBeGreaterThan(0);
    render(<PollResults view={view} lang="en" />);
    expect(screen.getByRole("table", { name: "People who voted" })).toBeInTheDocument();
    expect(screen.getByText("Only staff can see this.")).toBeInTheDocument();
  });
  it("no votes yet: the mascot empty state, never an empty chart", () => {
    const view = pollResults({ ...db, poll_votes: [] }, open.id, staff, NOW)!;
    const { container } = render(<PollResults view={view} lang="mn" />);
    expect(screen.getByText("Одоогоор санал алга")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).toBeNull();
    expect(container.textContent).not.toMatch(/NaN|Infinity|undefined/);
  });
});

describe("PollStatusActions: confirms name the poll, the audience and the head count", () => {
  const props = { lang: "en" as const, pollId: "poll_9", title: { mn: "Сэдэв", en: "Next workshop" }, audience: "members" as const, people: 38, voters: 12 };
  it("Publish and notify 38 people", async () => {
    const user = userEvent.setup();
    render(<PollStatusActions {...props} status="draft" />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const d = await screen.findByRole("alertdialog");
    expect(within(d).getByRole("heading", { name: "Publish “Next workshop” and notify 38 people?" })).toBeInTheDocument();
    expect(d.textContent).toContain("Audience: Members");
    await user.click(within(d).getByRole("button", { name: "Publish and notify" }));
    expect(setStatus).toHaveBeenCalledWith("poll_9", "published");
    expect(await screen.findByText("Published. 38 people notified.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
  it("Cancel and Escape never publish", async () => {
    const user = userEvent.setup();
    render(<PollStatusActions {...props} status="draft" />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(setStatus).not.toHaveBeenCalled();
  });
  it("nobody eligible: says so and does not promise a notification", async () => {
    const user = userEvent.setup();
    render(<PollStatusActions {...props} people={0} status="draft" />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const d = await screen.findByRole("alertdialog");
    expect(d.textContent).toContain("nobody is notified");
    expect(d.textContent).not.toContain("notify 0");
  });
  it("Close poll names the voters; Reopen says nobody is mailed twice", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PollStatusActions {...props} status="published" />);
    await user.click(screen.getByRole("button", { name: "Close poll" }));
    const d = await screen.findByRole("alertdialog");
    expect(within(d).getByRole("heading", { name: "Close “Next workshop”?" })).toBeInTheDocument();
    expect(d.textContent).toContain("12 people have voted");
    await user.click(within(d).getByRole("button", { name: "Close poll" }));
    expect(setStatus).toHaveBeenCalledWith("poll_9", "closed");
    unmount();
    render(<PollStatusActions {...props} status="closed" />);
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect((await screen.findByRole("alertdialog")).textContent).toContain("Nobody who was already notified is emailed twice");
  });
  it("a rule error becomes a sentence, never the code", async () => {
    setStatus.mockResolvedValueOnce({ ok: false, error: "conflict" });
    const user = userEvent.setup();
    render(<PollStatusActions {...props} status="draft" />);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Publish and notify" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("status changed in the meantime");
    expect(alert.textContent).not.toMatch(/\bconflict\b/);
  });
});

describe("PollEditor", () => {
  const counts = audienceCounts(db);
  it("with votes the ballot is read-only and the reason is shown; wording and times stay editable", () => {
    render(<PollEditor lang="en" pollId={open.id} initial={draftFromPoll(open)} counts={counts} voters={27} />);
    expect(screen.getByRole("note")).toHaveTextContent("27 people have voted, so the options");
    expect(screen.getByLabelText("Option 1 · Mongolian")).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Add option" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove option 1" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Pick several/ })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Anonymous votes" })).toBeDisabled();
    expect(screen.getByLabelText("When do people see the results?")).toBeEnabled();
  });
  it("the audience line says how many people can vote and follows the choice; anonymity is explained in one line", async () => {
    const user = userEvent.setup();
    render(<PollEditor lang="en" initial={draftFromPoll({ ...open, anonymous: false })} counts={{ members: 38, community: 51, everyone: 90 }} voters={0} />);
    expect(screen.getByText("38 people can vote")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Members and alumni/ }));
    expect(screen.getByText("51 people can vote")).toBeInTheDocument();
    expect(screen.getByText("You can see who voted for what. Members never see names.")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Anonymous votes" }));
    expect(screen.getByText(/Nobody, you included, sees who voted for what/)).toBeInTheDocument();
  });
  it("new poll: invalid → inline errors, focus on the first, nothing sent; valid → create and go to the poll", async () => {
    const user = userEvent.setup();
    render(<PollEditor lang="en" initial={draftFromPoll({ ...open, title: { mn: "", en: "" }, options: [{ id: "o1", label: { mn: "", en: "" } }, { id: "o2", label: { mn: "", en: "" } }] })} counts={counts} voters={0} />);
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(create).not.toHaveBeenCalled();
    expect(screen.getByText("Write a Mongolian title (under 200 characters).")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Title" })).getByLabelText(/^Mongolian/)).toHaveFocus();
    await user.type(within(screen.getByRole("group", { name: "Title" })).getByLabelText(/^Mongolian/), "Сэдэв");
    await user.type(screen.getByLabelText("Option 1 · Mongolian"), "A");
    await user.type(screen.getByLabelText("Option 2 · Mongolian"), "B");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(create).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/en/admin/polls/poll_new?tab=settings&created=1");
  });
  it("option ids are stable: adding after removing never reuses an id", async () => {
    const user = userEvent.setup();
    render(<PollEditor lang="en" pollId="p" initial={draftFromPoll({ ...open, options: [{ id: "o1", label: { mn: "A", en: "" } }, { id: "o2", label: { mn: "B", en: "" } }, { id: "o3", label: { mn: "C", en: "" } }] })} counts={counts} voters={0} />);
    await user.click(screen.getByRole("button", { name: "Remove option 3" }));
    await user.click(screen.getByRole("button", { name: "Add option" }));
    await user.type(screen.getByLabelText("Option 3 · Mongolian"), "D");
    await user.type(within(screen.getByRole("group", { name: "Title" })).getByLabelText(/^English/), "x");
    await user.click(screen.getByRole("button", { name: "Save" }));
    const sent = update.mock.calls[0][1] as { options: { id: string }[] };
    expect(sent.options.map((o) => o.id)).toEqual(["o1", "o2", "o4"]);
  });
});

describe("PollsList", () => {
  it("rows show audience, phase, turnout meter and closing date; empty list offers the one action", () => {
    const rows = pollRows(db, NOW);
    const { unmount } = render(<PollsList rows={rows} lang="en" />);
    const row = screen.getAllByRole("row").find((r) => r.textContent?.includes(open.title.en))!;
    expect(row).toHaveTextContent("Members");
    expect(row).toHaveTextContent("Open");
    expect(within(row).getByRole("meter")).toHaveAttribute("aria-label", expect.stringMatching(/\d+ of \d+ people voted/));
    unmount();
    render(<PollsList rows={[]} lang="en" />);
    expect(screen.getByText("No polls yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New poll" })).toHaveAttribute("href", "/en/admin/polls/new");
  });
});
