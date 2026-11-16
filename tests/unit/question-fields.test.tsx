import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuestionFields, { validateAnswers } from "@/components/forms/QuestionFields";
import type { Answers, Question } from "@/lib/events/questions";

const qs: Question[] = [
  { id: "why", type: "long", required: true, label: { mn: "Яагаад?", en: "Why?" } },
  { id: "nick", type: "short", required: false, label: { mn: "Хоч нэр", en: "" } },
  { id: "site", type: "url", required: false, label: { mn: "Сайт", en: "Website" } },
  { id: "level", type: "select", required: true, label: { mn: "Түвшин", en: "Level" }, options: [{ mn: "Анхан", en: "Beginner" }, { mn: "Ахисан", en: "Advanced" }] },
  { id: "topics", type: "multi", required: true, label: { mn: "Сэдэв", en: "Topics" }, options: [{ mn: "Веб", en: "Web" }, { mn: "AI", en: "AI" }, { mn: "Дизайн", en: "Design" }] },
  { id: "rules", type: "checkbox", required: true, label: { mn: "Дүрэм", en: "I accept the rules" } },
];

function Harness({ errors, initial = {} }: { errors?: Record<string, string>; initial?: Answers }) {
  const [a, setA] = useState<Answers>(initial);
  return (<><QuestionFields questions={qs} answers={a} onChange={setA} errors={errors} lang="en" /><output data-testid="answers">{JSON.stringify(a)}</output></>);
}
const answers = () => JSON.parse(screen.getByTestId("answers").textContent ?? "{}") as Answers;

describe("QuestionFields", () => {
  it("renders every question type with a visible label (English falls back to Mongolian)", () => {
    render(<Harness />);
    expect(screen.getByLabelText(/^Why\?/)).toBeInstanceOf(HTMLTextAreaElement);
    expect(screen.getByLabelText(/Хоч нэр/)).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByLabelText(/Website/)).toHaveAttribute("type", "url");
    expect(screen.getByLabelText(/^Level/)).toBeInstanceOf(HTMLSelectElement);
    expect(screen.getByRole("group", { name: /Topics/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /I accept the rules/ })).toBeInTheDocument();
  });

  it("stores select and multi answers as option indexes and shows option labels", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.selectOptions(screen.getByLabelText(/^Level/), "Advanced");
    await user.click(screen.getByRole("checkbox", { name: "AI" }));
    await user.click(screen.getByRole("checkbox", { name: "Web" }));
    await user.click(screen.getByRole("checkbox", { name: /I accept the rules/ }));
    await user.type(screen.getByLabelText(/^Why\?/), "To learn");
    expect(answers()).toEqual({ level: "1", topics: ["0", "1"], rules: true, why: "To learn" });
  });

  it("omits an answer that was cleared", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ level: "0" }} />);
    await user.selectOptions(screen.getByLabelText(/^Level/), "");
    expect(answers()).toEqual({});
  });

  it("marks invalid controls and places the message beside them", () => {
    render(<Harness errors={{ why: "required", level: "bad_option", topics: "required", rules: "required", site: "bad_url" }} />);
    const why = screen.getByLabelText(/^Why\?/);
    expect(why).toHaveAttribute("aria-invalid", "true");
    expect(why.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(why.getAttribute("aria-describedby")!.split(" ")[0])).toHaveTextContent("Fill in this field.");
    expect(screen.getByLabelText(/Website/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("group", { name: /Topics/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("checkbox", { name: /I accept the rules/ })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Pick one from the list.")).toBeInTheDocument();
  });

  it("validateAnswers uses the server schema", () => {
    expect(validateAnswers(qs, {})).toEqual({ why: "required", level: "required", topics: "required", rules: "required" });
    expect(validateAnswers(qs, { why: "x", level: "9", topics: ["0"], rules: true, site: "ftp://x" })).toEqual({ level: "bad_option", site: "bad_url" });
    expect(validateAnswers(qs, { why: "x", level: "1", topics: ["2"], rules: true })).toEqual({});
  });
});
