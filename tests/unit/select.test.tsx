import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Select from "@/components/ui/Select";

const OPTIONS = [
  { value: "joined", label: "Joined" },
  { value: "seen", label: "Last seen" },
  { value: "x", label: "Disabled one", disabled: true },
  { value: "seat", label: "Seats" },
];

function Harness({ onValueChange = () => {}, initial = "joined" }: { onValueChange?: (v: string) => void; initial?: string }) {
  const [v, setV] = useState(initial);
  return <>
    <label htmlFor="by">Date applies to</label>
    <Select id="by" name="by" value={v} onValueChange={(x) => { setV(x); onValueChange(x); }} options={OPTIONS} />
  </>;
}

describe("Select (themed listbox)", () => {
  it("is a labelled combobox that shows the chosen option and submits it under name", () => {
    const { container } = render(<Harness />);
    const box = screen.getByRole("combobox", { name: "Date applies to" });
    expect(box).toHaveTextContent("Joined");
    expect(box).toHaveAttribute("aria-haspopup", "listbox");
    expect(box).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector('input[type="hidden"][name="by"]')).toHaveValue("joined");
  });
  it("opens a listbox with the current option selected, picks by click and returns focus to the trigger", async () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    const box = screen.getByRole("combobox");
    await userEvent.click(box);
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Joined" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("option", { name: "Last seen" }));
    expect(onValueChange).toHaveBeenCalledWith("seen");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(box).toHaveTextContent("Last seen");
    expect(box).toHaveFocus();
  });
  it("moves with the arrows (skipping disabled options), picks with Enter and closes on Escape without changing", async () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    const box = screen.getByRole("combobox");
    box.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Seats" }).id);
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith("seat");
    await userEvent.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });
  it("jumps to a match by typing, open or closed, and never selects a disabled option", async () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);
    const box = screen.getByRole("combobox");
    box.focus();
    await userEvent.keyboard("l");
    expect(onValueChange).toHaveBeenLastCalledWith("seen");
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("d");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).not.toHaveBeenCalledWith("x");
  });
});
