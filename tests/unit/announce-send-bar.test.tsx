import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlockReason } from "@/lib/announce/compose-state";
import SendBar from "@/components/admin/comms/compose/SendBar";

afterEach(cleanup);

const base = {
  lang: "en" as const, reason: null as BlockReason | null, subject: "Spring meetup", kind: "members" as const, eventTitle: "", audienceLabel: "Members",
  willReceive: 142, optedOut: 3, plan: { perDay: 80, reserved: 20 }, enMissing: false, sending: false,
};
const setup = (over: Partial<Parameters<typeof SendBar>[0]> = {}) => {
  const onConfirm = vi.fn();
  render(<SendBar {...base} {...over} onConfirm={onConfirm} />);
  return onConfirm;
};

describe("SendBar: disabled reasons", () => {
  const cases: [BlockReason, string][] = [
    ["audience", "Choose who gets it."],
    ["event", "Choose an event."],
    ["statuses", "Pick at least one registration status."],
    ["subject", "Write a subject."],
    ["body", "Write a message."],
    ["subjectLong", "The subject is too long."],
    ["bodyLong", "The message is too long."],
    ["counting", "Counting recipients…"],
    ["nobody", "Nobody in this group can receive it."],
    ["sent", "This announcement was sent. Edit it or start a new one to send again."],
  ];
  it.each(cases)("%s: the button is disabled and the reason is written next to it", async (reason, text) => {
    const onConfirm = setup({ reason });
    const button = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(text)).toBeTruthy();
    expect(button.getAttribute("aria-describedby")).toBe(screen.getByText(text).id);
    await userEvent.setup().click(button);
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("is disabled while sending", () => {
    setup({ sending: true });
    expect((screen.getByRole("button", { name: "Sending…" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("SendBar: the confirmation", () => {
  it("names the subject, the audience and the number, the free-plan sentence and the opt-outs", async () => {
    const onConfirm = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Send “Spring meetup” to 142 members?");
    expect(dialog.textContent).toContain("About 2 days: 80 emails go out per day, 20 are kept for confirmations.");
    expect(dialog.textContent).toContain("3 people who opted out of announcements are skipped.");
    expect(dialog.textContent).not.toContain("no English version");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
  it("Cancel never sends", async () => {
    const onConfirm = setup();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("a small audience goes out today; a missing English version is called out; an event audience names the event", async () => {
    setup({ willReceive: 1, optedOut: 0, enMissing: true, kind: "event", eventTitle: "Knowledge Day" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Send" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("Send “Spring meetup” to 1 person registered for “Knowledge Day”?");
    expect(dialog.textContent).toContain("Goes out today.");
    expect(dialog.textContent).toContain("Nobody in this group opted out of announcements.");
    expect(dialog.textContent).toContain("There is no English version");
  });
  it("Mongolian", async () => {
    setup({ lang: "mn", audienceLabel: "Гишүүд" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Илгээх" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("“Spring meetup” зарлалыг 142 хүнд илгээх үү?");
    expect(dialog.textContent).toContain("Гишүүд");
  });
});
