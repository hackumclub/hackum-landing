import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
  it("emits the UTC instant for a UB wall-clock entry (date from the calendar box, time as HH:mm) and shows the UTC+8 label", async () => {
    const onChange = vi.fn();
    render(<DateTimeField name="starts_at" label="Starts" tzLabel="UTC+8 · Улаанбаатар" value={null} onChange={onChange} />);
    await userEvent.click(screen.getByLabelText("Starts"));
    await userEvent.type(screen.getByLabelText(/Date \(YYYY-MM-DD\)/), "2026-12-01{Enter}");
    // Picking a date first fills 09:00 (UB) = 01:00 UTC.
    expect((onChange.mock.calls.at(-1)![0] as Date).toISOString()).toBe("2026-12-01T01:00:00.000Z");
    expect(screen.getByText("UTC+8 · Улаанбаатар")).toBeInTheDocument();
  });
  it("shows a stored instant on the UB clock and re-emits it when the time changes", async () => {
    const onChange = vi.fn();
    render(<DateTimeField name="starts_at" label="Starts" tzLabel="UTC+8" value={new Date("2026-12-01T10:00:00Z")} onChange={onChange} />);
    const time = screen.getByLabelText(/Starts: Time/);
    expect(time).toHaveValue("18:00");
    expect(screen.getByLabelText("Starts")).toHaveTextContent("Dec 1, 2026");
    await userEvent.clear(time);
    await userEvent.type(time, "1930");
    await userEvent.tab();
    expect((onChange.mock.calls.at(-1)![0] as Date).toISOString()).toBe("2026-12-01T11:30:00.000Z");
    expect(document.querySelector('input[type="hidden"][name="starts_at"]')).toHaveValue("2026-12-01T10:00:00.000Z");
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

describe("DataTable pagination and selection bar", () => {
  const MANY: Row[] = Array.from({ length: 25 }, (_, i) => ({ id: `r${i + 1}`, name: `Row ${i + 1}`, rsvps: i + 1 }));
  const mount = (rows: Row[] = MANY, selectionBar?: (ids: string[]) => React.ReactNode) =>
    render(<DataTable rows={rows} columns={COLS} getId={(r) => r.id} caption="Events" selectable pageSize={10} selectionBar={selectionBar} empty={<p>None</p>} />);
  const bodyRows = () => screen.getAllByRole("row").length - 1;

  it("shows the first page and a Showing a–b of n line", () => {
    mount();
    expect(bodyRows()).toBe(10);
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.queryByText("Row 11")).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1–10 of 25/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
  });
  it("moves between pages with the page buttons", async () => {
    mount();
    await userEvent.click(screen.getByRole("button", { name: "3" }));
    expect(bodyRows()).toBe(5);
    expect(screen.getByText(/Showing 21–25 of 25/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "1" })).not.toHaveAttribute("aria-current");
  });
  it("renders no pager when everything fits on one page", () => {
    mount(MANY.slice(0, 5));
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
  it("renders the selection bar only when ids are selected, and selection survives a page change", async () => {
    mount(MANY, (ids) => <div>Bar: {ids.length} selected</div>);
    expect(screen.queryByText(/Bar:/)).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("checkbox")[1]);
    await userEvent.click(screen.getAllByRole("checkbox")[2]);
    expect(screen.getByText("Bar: 2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("Bar: 2 selected")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(screen.getByText("Bar: 3 selected")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "1" }));
    expect(screen.getAllByRole("checkbox")[1]).toBeChecked();
  });
  it("sits above the phone tab bar", async () => {
    mount(MANY, () => <div>Bar</div>);
    await userEvent.click(screen.getAllByRole("checkbox")[1]);
    expect(screen.getByText("Bar").parentElement?.className).toContain("bottom-[calc(var(--tab-bar,0px)+0.75rem)]");
  });
  it("goes back to page 1 when the number of rows changes", async () => {
    const { rerender } = mount();
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText(/Showing 11–20 of 25/)).toBeInTheDocument();
    rerender(<DataTable rows={MANY.slice(0, 18)} columns={COLS} getId={(r) => r.id} caption="Events" selectable pageSize={10} empty={<p>None</p>} />);
    expect(screen.getByText(/Showing 1–10 of 18/)).toBeInTheDocument();
  });
  it("select-all selects every row across pages", async () => {
    mount(MANY, (ids) => <div>Bar: {ids.length}</div>);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(screen.getByText("Bar: 25")).toBeInTheDocument();
  });
});
