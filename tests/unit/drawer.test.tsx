import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import Drawer from "@/components/ui/Drawer";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open drawer</button>
      <Drawer open={open} onOpenChange={setOpen} title="Registration" description="Details" closeLabel="Close">
        <button type="button">Inside</button>
      </Drawer>
    </>
  );
}

describe("Drawer", () => {
  it("is a floating rounded panel on >= sm and a bottom sheet with a grab handle on phones", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open drawer" }));
    const dialog = screen.getByRole("dialog", { name: "Registration" });
    for (const c of ["rounded-[28px]", "sm:right-3", "sm:inset-y-3", "sm:border", "sm:shadow-[var(--shadow-float)]", "inset-x-0", "bottom-0", "max-h-[88dvh]", "rounded-t-[28px]"]) {
      expect(dialog.className, c).toContain(c);
    }
    expect(dialog.querySelector("[data-grab-handle]")).not.toBeNull();
  });
  it("closes on Escape, restores focus to the trigger, and keeps the close button labelled", async () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open drawer" });
    await userEvent.click(trigger);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("traps focus: Tab cycles inside the drawer", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open drawer" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});
