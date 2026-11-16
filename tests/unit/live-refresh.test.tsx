import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import LiveRefresh, { backoffDelay } from "@/components/live/LiveRefresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

class FakeES {
  static all: FakeES[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeES.all.push(this); }
  close() { this.closed = true; }
  emit(v: number) { this.onmessage?.({ data: JSON.stringify({ v }) }); }
}

const setHidden = (h: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("backoffDelay", () => {
  it("grows exponentially, is capped at 30s and fully jittered", () => {
    expect(backoffDelay(0, () => 0.999)).toBeLessThan(1000);
    expect(backoffDelay(3, () => 0.999)).toBeLessThan(8000);
    expect(backoffDelay(3, () => 0.999)).toBeGreaterThan(7000);
    expect(backoffDelay(20, () => 0.999)).toBeLessThan(30_000);
    expect(backoffDelay(20, () => 0.999)).toBeGreaterThan(29_000);
    expect(backoffDelay(5, () => 0)).toBe(0);
  });
});

describe("LiveRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeES.all = [];
    refresh.mockClear();
    vi.stubGlobal("EventSource", FakeES);
    setHidden(false);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("renders nothing visible (no pill, no dot)", () => {
    const { container } = render(<LiveRefresh />);
    expect(container).toBeEmptyDOMElement();
  });
  it("refreshes once, debounced, when the version changes (and not on the first message)", () => {
    render(<LiveRefresh />);
    const es = FakeES.all[0];
    es.emit(1);
    act(() => { vi.advanceTimersByTime(500); });
    expect(refresh).not.toHaveBeenCalled();
    es.emit(2); es.emit(3);
    act(() => { vi.advanceTimersByTime(200); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("reconnects after an error with a backoff delay", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    render(<LiveRefresh />);
    FakeES.all[0].onerror?.();
    expect(FakeES.all[0].closed).toBe(true);
    expect(FakeES.all).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(499); });
    expect(FakeES.all).toHaveLength(1);
    act(() => { vi.advanceTimersByTime(2); });
    expect(FakeES.all).toHaveLength(2);
    vi.restoreAllMocks();
  });
  it("disconnects while the tab is hidden and reconnects when it is shown again", () => {
    render(<LiveRefresh />);
    act(() => setHidden(true));
    expect(FakeES.all[0].closed).toBe(true);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(FakeES.all).toHaveLength(1);
    act(() => setHidden(false));
    expect(FakeES.all).toHaveLength(2);
    expect(FakeES.all[1].closed).toBe(false);
  });
  it("closes the stream on unmount", () => {
    const { unmount } = render(<LiveRefresh />);
    unmount();
    expect(FakeES.all[0].closed).toBe(true);
  });
});
