import { useState } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SchoolMajorFields, { copy } from "@/components/profile/SchoolMajorFields";
import type { AcademicInput } from "@/lib/mockdb/academic";
import { PROGRAMS_FIXTURE } from "./helpers/num-programs-fixture";

vi.mock("@/lib/num/programs", async (orig) => {
  const actual = await orig<typeof import("@/lib/num/programs")>();
  return { ...actual, loadPrograms: vi.fn(async () => PROGRAMS_FIXTURE) };
});

const EMPTY: AcademicInput = { school_id: "num", school_name: "", major_track: "other", program_index: null, major_label: "" };

function Harness({ initial = EMPTY, lang = "en", spy }: { initial?: AcademicInput; lang?: "mn" | "en"; spy?: (v: AcademicInput) => void }) {
  const [v, setV] = useState(initial);
  return <SchoolMajorFields value={v} lang={lang} onChange={(n) => { spy?.(n); setV(n); }} />;
}
/** Field labels carry an aria-hidden " *" when required; match the label text exactly otherwise. */
const lbl = (t: string) => new RegExp(`^${t}(\\s\\*)?$`);
// The track <select> also has role "option" children: always scope option queries to the listbox.
const options = async () => within(await screen.findByRole("listbox")).findAllByRole("option");
const option = async (name: RegExp) => within(await screen.findByRole("listbox")).findByRole("option", { name });
const last = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.at(-1)![0] as AcademicInput;

describe("SchoolMajorFields: school", () => {
  it("lists schools in the user's language", () => {
    render(<Harness lang="mn" />);
    const select = screen.getByLabelText(lbl(copy.mn.school));
    expect(select).toHaveDisplayValue("МУИС");
    expect(screen.getByRole("option", { name: "Өөр сургууль" })).toBeInTheDocument();
  });
  it("choosing 'Another school' removes the combobox and shows the school name field and the guest note", async () => {
    render(<Harness />);
    expect(screen.getByRole("combobox", { name: "NUM program" })).toBeInTheDocument();
    expect(screen.queryByText(copy.en.guestNote)).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(lbl("School")), "other");
    expect(screen.queryByRole("combobox", { name: "NUM program" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(lbl("School name"))).toBeInTheDocument();
    expect(screen.getByText("Members must study at NUM; you can still join as a guest.")).toBeInTheDocument();
    expect(screen.getByLabelText(lbl("Major"))).toBeInTheDocument();
  });
  it("a known non-NUM school shows the note but no school-name field", async () => {
    render(<Harness />);
    await userEvent.selectOptions(screen.getByLabelText(lbl("School")), "must");
    expect(screen.queryByLabelText(lbl("School name"))).not.toBeInTheDocument();
    expect(screen.getByText(copy.en.guestNote)).toBeInTheDocument();
  });
  it("leaving NUM clears the program index", async () => {
    const spy = vi.fn();
    render(<Harness initial={{ ...EMPTY, program_index: "D 061301", major_label: "Computer science", major_track: "cs" }} spy={spy} />);
    await userEvent.selectOptions(screen.getByLabelText(lbl("School")), "must");
    expect(last(spy)).toMatchObject({ school_id: "must", program_index: null, major_track: "cs" });
  });
  it("shows the Mongolian note in mn", () => {
    render(<Harness lang="mn" initial={{ ...EMPTY, school_id: "must" }} />);
    expect(screen.getByText(copy.mn.guestNote)).toBeInTheDocument();
  });
  it("shows field errors next to their controls", () => {
    render(<SchoolMajorFields value={{ ...EMPTY, school_id: "other" }} lang="en" onChange={() => {}} errors={{ school_name: "Enter your school", major_track: "Pick a track" }} />);
    expect(screen.getByLabelText(lbl("School name"))).toHaveAccessibleDescription("Enter your school");
    expect(screen.getByLabelText(lbl("Major track"))).toBeInvalid();
  });
});

describe("SchoolMajorFields: NUM program combobox", () => {
  it("exposes ARIA 1.2 combobox attributes and a labelled listbox", async () => {
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "NUM program" });
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).toHaveAttribute("aria-autocomplete", "list");
    expect(box).toHaveAttribute("aria-controls");
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-expanded", "true");
    const list = await screen.findByRole("listbox");
    expect(list.id).toBe(box.getAttribute("aria-controls"));
    expect(list).toHaveAccessibleName();
    expect(screen.getByText(/CC BY-SA/)).toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}");
    const active = box.getAttribute("aria-activedescendant")!;
    expect(document.getElementById(active)).toHaveAttribute("role", "option");
    expect(document.getElementById(active)).toHaveAttribute("aria-selected", "true");
  });
  it("loads programs lazily on first focus, not on mount", async () => {
    const { loadPrograms } = await import("@/lib/num/programs");
    vi.mocked(loadPrograms).mockClear();
    render(<Harness />);
    expect(loadPrograms).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("combobox", { name: "NUM program" }));
    expect(loadPrograms).toHaveBeenCalledTimes(1);
  });
  it("typing 'comp' lists Computer science and selecting emits track cs, program index and the English name", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.type(screen.getByRole("combobox", { name: "NUM program" }), "comp");
    const opt = await option(/Computer science/);
    expect(opt).toHaveTextContent("D 061301");
    expect(opt).toHaveTextContent("ХШУИС");
    await userEvent.click(opt);
    expect(last(spy)).toEqual({ school_id: "num", school_name: "", major_track: "cs", program_index: "D 061301", major_label: "Computer science" });
    expect(screen.getByRole("combobox", { name: "NUM program" })).toHaveValue("Computer science");
    expect(screen.getByRole("combobox", { name: "NUM program" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText(lbl("Major track"))).toHaveDisplayValue("Computer science");
  });
  it("emits the Mongolian name in mn", async () => {
    const spy = vi.fn();
    render(<Harness lang="mn" spy={spy} />);
    await userEvent.type(screen.getByRole("combobox", { name: copy.mn.program }), "программ");
    await userEvent.click(await option(/Программ хангамж/));
    expect(last(spy)).toMatchObject({ major_label: "Программ хангамж", major_track: "software", program_index: "D 061302" });
  });
  it("defaults to bachelor and the level buttons switch to master", async () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Level" });
    expect(screen.getByRole("button", { name: "Bachelor" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.type(screen.getByRole("combobox", { name: "NUM program" }), "computer");
    await waitFor(async () => expect(await options()).toHaveLength(1));
    await userEvent.click(screen.getByRole("button", { name: "Master" }));
    expect(group).toContainElement(screen.getByRole("button", { name: "Master" }));
    expect(screen.getByRole("button", { name: "Master" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("combobox", { name: "NUM program" }));
    const opts = await options();
    expect(opts).toHaveLength(1);
    expect(opts[0]).toHaveTextContent("E 061301");
  });
  it("ArrowDown + Enter selects the first option; Enter alone never selects", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const box = screen.getByRole("combobox", { name: "NUM program" });
    await userEvent.type(box, "soft");
    await option(/Software engineering/);
    await userEvent.keyboard("{Enter}");
    expect(spy).not.toHaveBeenCalled();
    // ArrowDown flushes the pending debounce first, so Enter never picks from a stale list.
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(last(spy)).toMatchObject({ program_index: "D 061302", major_track: "software" });
    expect(box).toHaveAttribute("aria-expanded", "false");
  });
  it("ArrowUp wraps to the last option; Home and End jump to the ends", async () => {
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "NUM program" });
    await userEvent.click(box);
    const rows = await options();
    await userEvent.keyboard("{ArrowUp}");
    expect(box).toHaveAttribute("aria-activedescendant", rows.at(-1)!.id);
    await userEvent.keyboard("{Home}");
    expect(box).toHaveAttribute("aria-activedescendant", rows[0].id);
    await userEvent.keyboard("{End}");
    expect(box).toHaveAttribute("aria-activedescendant", rows.at(-1)!.id);
  });
  it("Escape closes the list without selecting", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const box = screen.getByRole("combobox", { name: "NUM program" });
    await userEvent.type(box, "comp");
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(box).not.toHaveAttribute("aria-activedescendant");
    expect(spy).not.toHaveBeenCalled();
  });
  it("ArrowDown reopens a closed list", async () => {
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "NUM program" });
    await userEvent.click(box);
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{ArrowDown}");
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(await options()).not.toHaveLength(0);
  });
  it("says so when nothing matches", async () => {
    render(<Harness />);
    await userEvent.type(screen.getByRole("combobox", { name: "NUM program" }), "zzzzzz");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(copy.en.none));
    expect(within(screen.getByRole("listbox")).queryByRole("option")).not.toBeInTheDocument();
  });
  it("typing after a selection drops the stale program index", async () => {
    const spy = vi.fn();
    render(<Harness initial={{ ...EMPTY, program_index: "D 061301", major_label: "Computer science", major_track: "cs" }} spy={spy} />);
    await userEvent.type(screen.getByRole("combobox", { name: "NUM program" }), "x");
    expect(last(spy)).toMatchObject({ program_index: null, major_track: "cs" });
  });
  it("the track select stays editable after picking a program, and 'Other' shows a free-text major", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(screen.getByLabelText(lbl("Major"))).toBeInTheDocument(); // initial track is other
    await userEvent.selectOptions(screen.getByLabelText(lbl("Major track")), "it");
    expect(last(spy).major_track).toBe("it");
    expect(screen.queryByLabelText(lbl("Major"))).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(lbl("Major track")), "other");
    await userEvent.type(screen.getByLabelText(lbl("Major")), "Physics");
    expect(last(spy).major_label).toBe("Physics");
  });
});

describe("SchoolMajorFields: debounce", () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it("filters 200 ms after the last keystroke, not on every key", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime, delay: null });
    render(<Harness />);
    const box = screen.getByRole("combobox", { name: "NUM program" });
    await user.click(box);
    await options();
    const before = within(screen.getByRole("listbox")).getAllByRole("option").length;
    expect(before).toBeGreaterThan(1);
    await user.type(box, "comp");
    await act(async () => { vi.advanceTimersByTime(150); });
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(before); // still the unfiltered list
    await act(async () => { vi.advanceTimersByTime(60); });
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2)); // Computer science + Computational data analysis
    expect(within(screen.getByRole("listbox")).getAllByRole("option")[0]).toHaveTextContent("Computer science");
  });
});
