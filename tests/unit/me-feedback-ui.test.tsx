import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { feedbackCopy } from "@/components/me/feedback/copy";
import { NpsScale, StarRating } from "@/components/me/feedback/RadioScale";

const c = feedbackCopy.en;
function Stars({ start = null, onChange = () => {} }: { start?: number | null; onChange?: (n: number) => void }) {
  const [v, setV] = useState<number | null>(start);
  return <StarRating name="rating" value={v} onChange={(n) => { setV(n); onChange(n); }} label={c.ratingLabel} required words={c.ratingWords} starLabel={c.starLabel} chosen={c.ratingChosen} none={c.ratingNone} />;
}
function Nps({ start = null }: { start?: number | null }) {
  const [v, setV] = useState<number | null>(start);
  return <NpsScale name="nps" value={v} onChange={setV} label={c.npsLabel} required option={c.npsOption} low={c.npsLow} high={c.npsHigh} chosen={c.npsChosen} none={c.npsNone} error={undefined} />;
}

describe("star rating", () => {
  it("is a radiogroup named by its question with five stars labelled '1 of 5, Poor' … '5 of 5, Excellent'", () => {
    render(<Stars />);
    const group = screen.getByRole("radiogroup", { name: /Overall, how was it/ });
    const radios = screen.getAllByRole("radio");
    expect(group).toBeInTheDocument();
    expect(radios.map((r) => r.getAttribute("aria-label"))).toEqual(["1 of 5, Poor", "2 of 5, Fair", "3 of 5, Good", "4 of 5, Great", "5 of 5, Excellent"]);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText("Choose 1 to 5 stars")).toBeInTheDocument();
  });

  it("choosing a star says the number and the word in text, not colour alone", async () => {
    const onChange = vi.fn();
    render(<Stars onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "4 of 5, Great" }));
    expect(onChange).toHaveBeenCalledWith(4);
    expect(screen.getByRole("radio", { name: "4 of 5, Great" })).toBeChecked();
    expect(screen.getByText("You chose 4 of 5: Great")).toBeInTheDocument();
  });

  it("keyboard: Tab enters the group once, the arrow keys move and choose, the group wraps", async () => {
    const user = userEvent.setup();
    render(<><Stars /><button>after</button></>);
    await user.tab();
    expect(screen.getByRole("radio", { name: /^1 of 5/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("radio", { name: /^3 of 5/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /^3 of 5/ })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: /^2 of 5/ })).toBeChecked();
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus(); // one tab stop for the whole group
  });

  it("shows an error next to the group and ties it to the group", () => {
    render(<StarRating name="r" value={null} onChange={() => {}} label="Q" error="Pick a star rating." words={c.ratingWords} starLabel={c.starLabel} chosen={c.ratingChosen} none={c.ratingNone} />);
    const group = screen.getByRole("radiogroup");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group.getAttribute("aria-describedby")).toContain(screen.getByText("Pick a star rating.").id);
  });
});

describe("recommend score 0 to 10", () => {
  it("has eleven numbered radios with end labels that carry their numbers", () => {
    render(<Nps />);
    expect(screen.getByRole("radiogroup", { name: /recommend/ })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(11);
    expect(radios[0]).toHaveAccessibleName("0 of 10");
    expect(radios[10]).toHaveAccessibleName("10 of 10");
    expect(screen.getByText("0 · Not likely")).toBeInTheDocument();
    expect(screen.getByText("10 · Very likely")).toBeInTheDocument();
  });

  it("wraps into two rows on phones (six columns) and goes to one row from 640 px, with 44 px targets", () => {
    const { container } = render(<Nps />);
    const grid = container.querySelector(".grid-cols-6");
    expect(grid?.className).toContain("sm:grid-cols-11");
    for (const label of container.querySelectorAll("label")) expect(label.className).toMatch(/min-h-11/);
  });

  it("keyboard and click choose a score and the text repeats it", async () => {
    const user = userEvent.setup();
    render(<Nps />);
    await user.click(screen.getByRole("radio", { name: "7 of 10" }));
    expect(screen.getByText("You chose 7 of 10")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "8 of 10" })).toBeChecked();
    expect(screen.getByText("You chose 8 of 10")).toBeInTheDocument();
  });

  it("score 0 is a real answer, not 'nothing chosen'", async () => {
    render(<Nps start={0} />);
    expect(screen.getByRole("radio", { name: "0 of 10" })).toBeChecked();
    expect(screen.getByText("You chose 0 of 10")).toBeInTheDocument();
  });
});
