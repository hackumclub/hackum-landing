import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ListSpec } from "@/lib/admin/list-state";

// The hook reads Next's router state; here the "router" is the jsdom URL, which is what the History API updates.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  usePathname: () => window.location.pathname,
  useRouter: () => ({ replace: (url: string) => window.history.replaceState(null, "", url) }),
}));
import { useListState } from "@/components/admin/lists/useListState";

const SPEC: ListSpec = { search: true, dates: true, multi: { status: ["applied", "going"] }, single: { filter: ["applications"] } };

beforeEach(() => window.history.replaceState(null, "", "/en/admin/x?tab=applications"));

describe("useListState (client mode)", () => {
  it("starts from the URL, ignoring bad values", () => {
    window.history.replaceState(null, "", "/en/admin/x?status=applied,evil&filter=nope");
    const { result } = renderHook(() => useListState(SPEC));
    expect(result.current.state.multi.status).toEqual(["applied"]);
    expect(result.current.state.single.filter).toBeNull();
    expect(result.current.count).toBe(1);
  });

  it("writes chips and search to the URL, keeps unrelated parameters, and shows the change at once", () => {
    const { result } = renderHook(() => useListState(SPEC));
    act(() => result.current.setMulti("status", ["going"]));
    expect(window.location.search).toBe("?tab=applications&status=going");
    expect(result.current.state.multi.status).toEqual(["going"]);
    act(() => result.current.setQ("bat"));
    expect(window.location.search).toContain("q=bat");
    expect(window.location.search).toContain("status=going"); // the second change did not overwrite the first
    expect(result.current.count).toBe(2);
  });

  it("clear resets what the list owns but keeps the ignored single value (a tab)", () => {
    window.history.replaceState(null, "", "/en/admin/x?filter=applications&status=going&q=a");
    const { result } = renderHook(() => useListState(SPEC, { ignore: ["filter"] }));
    expect(result.current.count).toBe(2);
    act(() => result.current.clear());
    expect(window.location.search).toBe("?filter=applications");
    expect(result.current.count).toBe(0);
  });

  it("a date range needs both ends and resets the page", () => {
    window.history.replaceState(null, "", "/en/admin/x?page=3");
    const { result } = renderHook(() => useListState(SPEC));
    act(() => result.current.setRange({ from: "2026-09-01", to: "2026-12-31" }));
    expect(window.location.search).toBe("?from=2026-09-01&to=2026-12-31");
    act(() => result.current.setRange(null));
    expect(window.location.search).toBe("");
  });
});
