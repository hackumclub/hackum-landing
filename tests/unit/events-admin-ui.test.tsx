import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const setStatus = vi.fn(async () => ({ ok: true as const, data: undefined }));
vi.mock("@/lib/events/actions", () => ({ setEventStatusAction: (...a: unknown[]) => (setStatus as (...x: unknown[]) => unknown)(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { default: StatusActions } = await import("@/components/admin/events/StatusActions");
const { default: StagedChangeDialog } = await import("@/components/admin/events/StagedChangeDialog");

afterEach(() => { cleanup(); setStatus.mockClear(); });

describe("StatusActions: publish readiness (F-15)", () => {
  const setup = (missing: ("description" | "venue" | "cover" | "english")[]) =>
    render(<StatusActions lang="en" eventId="e_1" title="Spring Hack" status="draft" people={0} missing={missing} />);

  it("a complete event gets the plain confirm", async () => {
    const user = userEvent.setup();
    setup([]);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Publish “Spring Hack”?");
    expect(within(dialog).getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(within(dialog).queryByText("Publish anyway")).toBeNull();
  });

  it("lists what is missing and offers Publish anyway / Fix first", async () => {
    const user = userEvent.setup();
    setup(["description", "venue", "cover", "english"]);
    await user.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    for (const line of ["No description", "No venue", "No cover image", "No English text"]) expect(within(dialog).getByText(line)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Fix first" }));
    expect(setStatus).not.toHaveBeenCalled(); // nothing published
    await user.click(screen.getByRole("button", { name: "Publish" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Publish anyway" }));
    expect(setStatus).toHaveBeenCalledWith("e_1", "published");
  });

  it("Mongolian copy for the checklist", async () => {
    const user = userEvent.setup();
    render(<StatusActions lang="mn" eventId="e_1" title="Хакатон" status="draft" people={0} missing={["cover"]} />);
    await user.click(screen.getByRole("button", { name: "Нийтлэх" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Нүүр зураг алга")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Ямар ч байсан нийтлэх" })).toBeTruthy();
  });
});

describe("StagedChangeDialog: narrowing to МУИС", () => {
  const change = [{ key: "school_scope" as const, before: "all" as const, after: "num" as const, notifies: false }];
  it("says how many current registrants study elsewhere and that they keep their seats", () => {
    render(<StagedChangeDialog open onOpenChange={() => {}} lang="en" title="Spring Hack" willNotify={0} nonNumRegistrants={3} changes={change} onConfirm={() => {}} />);
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("3 current registrants study elsewhere; they keep their seats")).toBeTruthy();
    expect(within(dialog).getByText("Which students")).toBeTruthy();
    expect(within(dialog).getByText("All schools")).toBeTruthy();
    expect(within(dialog).getByText("МУИС only")).toBeTruthy();
  });
  it("is silent when nobody is affected, and singular for one person", () => {
    const { rerender } = render(<StagedChangeDialog open onOpenChange={() => {}} lang="en" title="T" willNotify={0} nonNumRegistrants={0} changes={change} onConfirm={() => {}} />);
    expect(screen.queryByText(/study elsewhere/)).toBeNull();
    rerender(<StagedChangeDialog open onOpenChange={() => {}} lang="en" title="T" willNotify={0} nonNumRegistrants={1} changes={change} onConfirm={() => {}} />);
    expect(screen.getByText("1 current registrant studies elsewhere; they keep their seat")).toBeTruthy();
  });
});
