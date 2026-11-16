// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createStore } from "@/lib/mockdb/store";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { addEvent, addProfile, emptyDb, NOW } from "./helpers/fixture";

function fresh() {
  const store = createStore({ seed: () => { const db = emptyDb(); addProfile(db, { id: "a" }); addEvent(db, { id: "e1", capacity: 1 }); return db; }, now: () => NOW });
  return store;
}

describe("mock store", () => {
  it("applies a rule to the shared db and bumps the version for every subscriber", () => {
    const store = fresh();
    const seen: number[] = [];
    store.subscribe((v) => seen.push(v));
    const before = store.version();
    const r = store.mutate((ctx) => registerForEvent(ctx, { eventId: "e1", answers: {} }), "a");
    expect(r).toEqual({ ok: true, data: { status: "going" } });
    expect(store.read().registrations).toHaveLength(1);
    expect(store.version()).toBe(before + 1);
    expect(seen).toEqual([before + 1]);
  });
  it("leaves the version alone when a rule is refused", () => {
    const store = fresh();
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.mutate((ctx) => registerForEvent(ctx, { eventId: "nope", answers: {} }), "a")).toEqual({ ok: false, error: "not_found" });
    expect(listener).not.toHaveBeenCalled();
  });
  it("stops notifying after unsubscribe, and reset restores the seed and tells everyone", () => {
    const store = fresh();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.mutate((ctx) => registerForEvent(ctx, { eventId: "e1", answers: {} }), "a");
    expect(listener).not.toHaveBeenCalled();
    const seen = vi.fn();
    store.subscribe(seen);
    store.reset();
    expect(store.read().registrations).toHaveLength(0);
    expect(seen).toHaveBeenCalledTimes(1);
  });
  it("runs the background tick: sends queued mail and bumps the version only when something happened", () => {
    const store = fresh();
    store.mutate((ctx) => registerForEvent(ctx, { eventId: "e1", answers: {} }), "a");
    const v = store.version();
    expect(store.tickNow()).toMatchObject({ sent: 1 });
    expect(store.version()).toBe(v + 1);
    expect(store.read().notifications[0].status).toBe("sent");
    expect(store.tickNow()).toMatchObject({ sent: 0 });
    expect(store.version()).toBe(v + 1);
  });
});
