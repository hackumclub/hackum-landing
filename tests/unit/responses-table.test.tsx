import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/lib/events/questions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { default: ResponsesTable } = await import("@/components/admin/forms/ResponsesTable");

afterEach(cleanup);
const sel: Question = { id: "exp", type: "select", required: true, label: { mn: "Туршлага", en: "Experience" }, options: [{ mn: "Анхан", en: "Beginner" }, { mn: "Ахисан", en: "Advanced" }] };
const row = (i: number, answers: Record<string, string | string[] | boolean>, status = "pending") => ({
  profile_id: `p${i}`, handle: `h${i}`, name: { mn: `Нэр ${i}`, en: `Name ${i}` }, submitted_at: `2026-11-1${i % 9}T04:00:00Z`, status, answers,
});

describe("ResponsesTable", () => {
  it("shows option text, a link to Members by handle, and keeps answers to removed questions as an extra column", async () => {
    render(<ResponsesTable lang="en" formId="membership_application" questions={[sel]} orphans={["old_q"]} emptyAction={<button type="button">go</button>} rows={[row(1, { exp: "1", old_q: "Still here" })]} />);
    expect(screen.getByRole("columnheader", { name: "Experience" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Removed question: old_q" })).toBeTruthy();
    const tr = screen.getAllByRole("row")[1];
    expect(within(tr).getAllByText("Advanced").length).toBeGreaterThan(0);
    expect(within(tr).getAllByText("Still here").length).toBeGreaterThan(0);
    expect(within(tr).getByRole("link", { name: "Find in Members: Name 1" }).getAttribute("href")).toBe("/en/admin/members?q=h1");
  });

  it("the drawer shows the full answer set, including the removed question with its tag", async () => {
    const user = userEvent.setup();
    render(<ResponsesTable lang="en" formId="membership_application" questions={[sel]} orphans={["old_q"]} emptyAction={null} rows={[row(1, { exp: "0", old_q: "x".repeat(300) })]} />);
    await user.click(screen.getByRole("button", { name: "View all answers: Name 1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Beginner")).toBeTruthy();
    expect(within(dialog).getByText("Removed question: old_q")).toBeTruthy();
    expect(within(dialog).getByText("x".repeat(300))).toBeTruthy(); // not clamped
  });

  it("paginates at 25 and exports through the CSV route in the active language", () => {
    const rows = Array.from({ length: 30 }, (_, i) => row(i + 1, { exp: "0" }));
    render(<ResponsesTable lang="mn" formId="event:e_1" questions={[sel]} orphans={[]} emptyAction={null} rows={rows} />);
    expect(screen.getAllByRole("row")).toHaveLength(26); // header + 25
    expect(screen.getByText("30-аас 1–25-г харуулж байна")).toBeTruthy();
    expect(screen.getByRole("link", { name: "CSV татах" }).getAttribute("href")).toBe("/api/admin/forms/event%3Ae_1/csv?lang=mn");
  });

  it("an empty form shows one action and no table", () => {
    render(<ResponsesTable lang="en" formId="join" questions={[sel]} orphans={[]} rows={[]} emptyAction={<button type="button">See the questions</button>} />);
    expect(screen.getByRole("heading", { name: "No responses yet" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("join submissions (no workflow state) show a neutral tag instead of a status pill", () => {
    render(<ResponsesTable lang="en" formId="join" questions={[sel]} orphans={[]} emptyAction={null} rows={[row(1, { exp: "0" }, "submitted")]} />);
    expect(within(screen.getAllByRole("row")[1]).getAllByText("Submitted").length).toBeGreaterThan(0);
  });
});
