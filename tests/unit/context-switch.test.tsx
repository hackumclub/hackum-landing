import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContextSwitch, { canSwitchContext } from "@/components/shell/ContextSwitch";
import AvatarMenu from "@/components/shell/AvatarMenu";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/admin/comms", useSearchParams: () => new URLSearchParams("status=failed"), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/server/auth-actions", () => ({ signInAs: vi.fn() }));

describe("ContextSwitch", () => {
  it("renders nothing for a member, a guest, or no role at all", () => {
    for (const roles of [["member"], ["guest"], [], null, undefined]) {
      const { container, unmount } = render(<ContextSwitch current="me" lang="en" roles={roles} />);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    expect(canSwitchContext(["alumni"])).toBe(false);
  });
  it.each(["organizer", "admin"])("shows Dashboard, Hackum and Site for %s, current one marked, Site opens the public home", (role) => {
    render(<ContextSwitch current="admin" lang="en" roles={[role]} />);
    expect(screen.getByRole("navigation", { name: "Choose area" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/en/admin");
    expect(screen.getByRole("link", { name: "Hackum" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Hackum" })).toHaveAttribute("href", "/en/me");
    expect(screen.getByRole("link", { name: "Site" })).toHaveAttribute("href", "/en");
    expect(screen.getByRole("link", { name: "Site" })).not.toHaveAttribute("aria-current");
  });
  it("marks Hackum current in the member app and speaks Mongolian", () => {
    render(<ContextSwitch current="me" lang="mn" roles={["organizer"]} />);
    expect(screen.getByRole("link", { name: "Hackum" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Самбар" })).toHaveAttribute("href", "/mn/admin");
    expect(screen.getByRole("link", { name: "Сайт" })).toHaveAttribute("href", "/mn");
  });
});

const personas = [{ handle: "dev-admin", label: { mn: "Админ", en: "Dev admin" } }, { handle: "anuujin", label: { mn: "Гишүүн", en: "Member" } }];
const menu = (demoEnabled: boolean) => (
  <AvatarMenu lang="en" area="admin" user={{ name: "Dev Admin", avatar: null }} role="admin" unread={3} demo={{ enabled: demoEnabled, personas, current: "dev-admin" }} langInMenu="mobile" />
);

describe("AvatarMenu", () => {
  it("lists Profile, Notifications (with the unread count), Settings and Sign out; Esc closes it and returns focus", async () => {
    const user = userEvent.setup();
    render(menu(true));
    const button = screen.getByRole("button", { name: "Account menu" });
    await user.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/en/me/profile");
    expect(screen.getByRole("link", { name: /Notifications/ })).toHaveAttribute("href", "/en/admin/inbox");
    expect(screen.getByLabelText("3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/en/me/settings");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
  it("keeps the query string in the language link (F-09) and shows the staff context switch for phones", async () => {
    const user = userEvent.setup();
    render(menu(true));
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByRole("link", { name: "Монгол хэл рүү шилжих" })).toHaveAttribute("href", "/mn/admin/comms?status=failed");
    expect(screen.getByRole("navigation", { name: "Choose area" })).toBeInTheDocument();
  });
  it("offers Switch demo account only when mock auth is on, marking the current account", async () => {
    const user = userEvent.setup();
    const { unmount } = render(menu(true));
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.getByText("Switch demo account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dev admin/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Member" })).toHaveAttribute("value", "anuujin");
    unmount();
    render(menu(false));
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.queryByText("Switch demo account")).not.toBeInTheDocument();
  });
});
