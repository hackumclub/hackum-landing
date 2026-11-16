import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationBell from "@/components/notifications/NotificationBell";
import type { BellData, InboxRow } from "@/lib/notifications/load";

const refresh = vi.fn();
const markAll = vi.fn(async () => ({ ok: true as const, data: { changed: 2 } }));
const markOne = vi.fn(async (ids: string[]) => ({ ok: true as const, data: { changed: ids.length } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/notifications/actions", () => ({ markAllReadAction: () => markAll(), markReadAction: (ids: string[]) => markOne(ids), loadMoreAction: vi.fn() }));

const row = (id: string, unread: boolean, over: Partial<InboxRow> = {}): InboxRow => ({
  id, kind: "rsvp_confirmed", title: `Title ${id}`, line: `Line ${id}`, href: `/en/events/${id}`, unread, createdAt: "2026-11-16T04:00:00Z", when: "5 minutes ago", ...over,
});
const data = (unread: number, items = [row("a", true), row("b", true), row("c", false)]): BellData => ({ unread, items });

beforeEach(() => { refresh.mockClear(); markAll.mockClear(); markOne.mockClear(); });

describe("NotificationBell", () => {
  it("puts the unread count in the button name and shows a CountBadge only when there is something unread", () => {
    const { rerender } = render(<NotificationBell lang="en" data={data(2)} seeAllHref="/en/me/notifications" />);
    expect(screen.getByRole("button", { name: "Notifications, 2 unread" })).toBeInTheDocument();
    expect(screen.getByLabelText("2")).toBeInTheDocument();
    rerender(<NotificationBell lang="en" data={data(0)} seeAllHref="/en/me/notifications" />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.queryByLabelText("0")).not.toBeInTheDocument();
  });
  it("announces a count change politely, but not on first render", () => {
    const { rerender } = render(<NotificationBell lang="en" data={data(2)} seeAllHref="/x" />);
    const live = screen.getByRole("status");
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toHaveTextContent("");
    rerender(<NotificationBell lang="en" data={data(3)} seeAllHref="/x" />);
    expect(live).toHaveTextContent("3 unread notifications");
  });
  it("opens a panel with the items, See all and Mark all read, without marking anything read", async () => {
    const user = userEvent.setup();
    render(<NotificationBell lang="en" data={data(2)} seeAllHref="/en/me/notifications" />);
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(screen.getByRole("dialog", { name: "Latest notifications" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Title a/ })).toHaveAttribute("href", "/en/events/a");
    expect(screen.getByRole("link", { name: "See all" })).toHaveAttribute("href", "/en/me/notifications");
    expect(markAll).not.toHaveBeenCalled();
    expect(markOne).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(markAll).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
  it("marks only the opened row read when it is followed", async () => {
    const user = userEvent.setup();
    render(<NotificationBell lang="en" data={data(2)} seeAllHref="/x" />);
    await user.click(screen.getByRole("button", { name: /Notifications/ }));
    await user.click(screen.getByRole("link", { name: /Title b/ }));
    await waitFor(() => expect(markOne).toHaveBeenCalledWith(["b"]));
    expect(markAll).not.toHaveBeenCalled();
  });
  it("tells unread rows apart without colour (hidden 'Unread' text) and hides Mark all read when nothing is unread", async () => {
    const user = userEvent.setup();
    render(<NotificationBell lang="en" data={data(0, [row("c", false)])} seeAllHref="/x" />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.queryByText("Unread:")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark all read" })).not.toBeInTheDocument();
  });
  it("Esc closes the panel and returns focus to the bell; an empty list shows the empty state", async () => {
    const user = userEvent.setup();
    render(<NotificationBell lang="en" data={data(0, [])} seeAllHref="/x" />);
    const bell = screen.getByRole("button", { name: "Notifications" });
    await user.click(bell);
    expect(screen.getByText("No new notifications")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bell).toHaveFocus();
  });
});
