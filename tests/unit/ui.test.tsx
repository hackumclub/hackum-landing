import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { fromUbInput, toUbInput } from "@/lib/time";
import DateTimeField from "@/components/ui/DateTimeField";
import BilingualField from "@/components/ui/BilingualField";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StatusPill, { STATUS_STYLE } from "@/components/ui/StatusPill";
import { ALL_STATUSES } from "@/lib/status";
import DataTable, { type Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import type { L } from "@/i18n/config";

describe("UB time conversion", () => {
  it("reads a datetime-local value as Asia/Ulaanbaatar regardless of the machine zone", () => {
    expect(process.env.TZ).toBe("America/New_York");
    expect(fromUbInput("2026-12-01T18:00")?.toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });
  it("formats a Date back to the UB wall clock", () => {
    expect(toUbInput(new Date("2026-12-01T10:00:00Z"))).toBe("2026-12-01T18:00");
  });
  it("rejects malformed input instead of producing Invalid Date", () => {
    expect(fromUbInput("2026-13-40T99:00")).toBeNull();
    expect(fromUbInput("")).toBeNull();
  });
});

describe("DateTimeField", () => {
  it("emits the UTC instant for a UB wall-clock entry and shows the UTC+8 label", () => {
    const onChange = vi.fn();
    render(<DateTimeField name="starts_at" label="Starts" tzLabel="UTC+8 · Улаанбаатар" value={null} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "2026-12-01T18:00" } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as Date).toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(screen.getByText("UTC+8 · Улаанбаатар")).toBeInTheDocument();
  });
});

const BI_LABELS = { mn: "Монгол", en: "English", copy: "Copy from Mongolian", enMissing: "English version missing" };

function BilingualHarness({ initial }: { initial: L }) {
  const [v, setV] = useState<L>(initial);
  return <BilingualField name="title" label="Title" value={v} onChange={setV} labels={BI_LABELS} />;
}

describe("BilingualField", () => {
  it("flags a missing English value and copies the Mongolian one on request", async () => {
    render(<BilingualHarness initial={{ mn: "Хакатон", en: "" }} />);
    expect(screen.getByText("English version missing")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy from Mongolian" }));
    expect(screen.getByLabelText(/English/)).toHaveValue("Хакатон");
    expect(screen.queryByText("English version missing")).not.toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("does not confirm on Escape and returns focus to the trigger", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button>Cancel event</Button>}
        title="Cancel “DevHack 2026”?"
        body="84 people will get a cancellation email."
        confirmLabel="Cancel event and email 84"
        cancelLabel="Keep event"
        tone="danger"
        onConfirm={onConfirm}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Cancel event" });
    await userEvent.click(trigger);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it("calls onConfirm from the named confirm button", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog trigger={<Button>Delete</Button>} title="t" body="b" confirmLabel="Delete 3 drafts" cancelLabel="Keep" tone="danger" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete 3 drafts" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("StatusPill", () => {
  it("has a style and renders a label for every status", () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_STYLE[s], s).toBeTruthy();
      const { unmount } = render(<StatusPill status={s} label={`L-${s}`} />);
      expect(screen.getByText(`L-${s}`)).toBeInTheDocument();
      unmount();
    }
  });
});

type Row = { id: string; name: string; rsvps: number };
const ROWS: Row[] = [
  { id: "a", name: "Workshop", rsvps: 12 },
  { id: "b", name: "Hackathon", rsvps: 140 },
  { id: "c", name: "Meetup", rsvps: 40 },
];
const COLS: Column<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name, sortValue: (r) => r.name },
  { key: "rsvps", header: "RSVPs", cell: (r) => r.rsvps, sortValue: (r) => r.rsvps, numeric: true },
];

describe("DataTable", () => {
  it("toggles aria-sort and row order when a sortable header is clicked", async () => {
    render(<DataTable rows={ROWS} columns={COLS} getId={(r) => r.id} caption="Events" empty={<p>None</p>} />);
    const header = screen.getByRole("columnheader", { name: /RSVPs/ });
    expect(header).toHaveAttribute("aria-sort", "none");
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    const firstCell = () => screen.getAllByRole("row")[1].querySelector("td:last-child")?.textContent;
    expect(firstCell()).toBe("12");
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(firstCell()).toBe("140");
  });
  it("renders the empty state when there are no rows", () => {
    render(<DataTable rows={[]} columns={COLS} getId={(r) => r.id} caption="Events" empty={<p>No events yet</p>} />);
    expect(screen.getByText("No events yet")).toBeInTheDocument();
  });
});

describe("DataTable row actions", () => {
  it("opens a row when its cell is clicked, but not when a button or checkbox inside it is", async () => {
    const onRowClick = vi.fn();
    render(<DataTable rows={ROWS} columns={[...COLS, { key: "act", header: "Act", cell: () => <button type="button">Do it</button> }]} getId={(r) => r.id} caption="Events" selectable onRowClick={onRowClick} empty={<p>None</p>} />);
    await userEvent.click(screen.getByText("Hackathon"));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0]).toMatchObject({ id: "b" });
    await userEvent.click(screen.getAllByRole("button", { name: "Do it" })[0]);
    await userEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });
  it("hides a column below the xl breakpoint and gives checkboxes a 20px target", () => {
    render(<DataTable rows={ROWS} columns={[...COLS, { key: "x", header: "Wide only", cell: (r) => r.id, hideBelow: "xl" }]} getId={(r) => r.id} caption="Events" selectable empty={<p>None</p>} />);
    expect(screen.getByRole("columnheader", { name: "Wide only" }).className).toContain("xl:table-cell");
    expect(screen.getAllByRole("checkbox")[0].className).toContain("size-5");
  });
});
