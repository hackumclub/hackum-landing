import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import ThemeToggle from "@/components/ui/ThemeToggle";
import OpsRoot from "@/components/ui/OpsRoot";

const labels = { group: "Theme", system: "System", light: "Light", dark: "Dark" };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const tree = <OpsRoot><ThemeToggle labels={labels} /></OpsRoot>;

afterEach(() => { localStorage.clear(); document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("ThemeToggle hydration (F-08)", () => {
  it("first client render equals the server markup when a theme is stored, then selects the stored theme after mount", async () => {
    localStorage.setItem("ops-theme", "dark");
    const serverHtml = renderToString(tree); // no storage on the server: renders the system default
    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.append(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => { hydrateRoot(container, tree); });
    expect(errors.mock.calls.map((c) => String(c[0]).slice(0, 80))).toEqual([]);
    const checked = [...container.querySelectorAll<HTMLInputElement>("input[type=radio]")].find((i) => i.checked);
    expect(checked?.value).toBe("dark");
  });

  it("server markup selects the system default only (it cannot know the stored theme)", () => {
    localStorage.setItem("ops-theme", "light");
    const container = document.createElement("div");
    container.innerHTML = renderToString(tree);
    const checked = [...container.querySelectorAll<HTMLInputElement>("input[type=radio]")].filter((i) => i.hasAttribute("checked")).map((i) => i.value);
    expect(checked).toEqual(["system"]);
  });
});
