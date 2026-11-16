"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useOptimistic, useState, useTransition } from "react";
import { activeCount, emptyListState, mergeIntoQuery, parseListState, type ListSpec, type ListState } from "@/lib/admin/list-state";

export type ListApi = {
  state: ListState;
  /** Number of active filters (what the Filters badge and "Clear filters" show). */
  count: number;
  /** A server-driven list is re-rendering with the new URL. */
  pending: boolean;
  setQ: (q: string) => void;
  setMulti: (group: string, values: string[]) => void;
  setSingle: (key: string, value: string | null) => void;
  setRange: (range: { from: string; to: string } | null) => void;
  /** Resets every filter this list owns, keeping `keep` (single values such as the tab) as they are. */
  clear: () => void;
};

/**
 * The filters of an admin list live in the URL, never in component state: they survive a reload, the language switch
 * and Back, and a dashboard link is just a URL. `client` lists filter rows they already hold, so the URL is updated
 * with the History API (Next syncs `useSearchParams` with it, no server round trip); `server` lists (audit) navigate,
 * so the server re-filters, and show the new state at once while it does.
 * `spec` must be a stable reference (module constant or `useMemo`).
 */
export function useListState(spec: ListSpec, { mode = "client", ignore = [] }: { mode?: "client" | "server"; ignore?: readonly string[] } = {}): ListApi {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const fromUrl = useMemo(() => parseListState(searchParams, spec), [searchParams, spec]);
  const [optimistic, setOptimistic] = useOptimistic(fromUrl);
  // Client lists show the new filter in the same frame; Next catches `useSearchParams` up a moment later, and from then
  // on the URL (the `fromUrl` object changes) is the truth again.
  const [local, setLocal] = useState<{ base: ListState; value: ListState } | null>(null);
  const state = mode === "client" ? (local && local.base === fromUrl ? local.value : fromUrl) : optimistic;

  const commit = useCallback((change: (s: ListState) => ListState) => {
    // Read the live URL, not a captured render: a debounced search and a chip click must not overwrite each other.
    const live = parseListState(new URLSearchParams(window.location.search), spec);
    const next = change(live);
    const qs = mergeIntoQuery(window.location.search, next, spec);
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (mode === "client") { setLocal({ base: fromUrl, value: next }); window.history.replaceState(null, "", url); }
    else startTransition(() => { setOptimistic(next); router.replace(url, { scroll: false }); });
  }, [spec, mode, pathname, router, setOptimistic, fromUrl]);

  return {
    state,
    count: activeCount(state, ignore),
    pending,
    setQ: (q) => commit((s) => ({ ...s, q, page: 1 })),
    setMulti: (group, values) => commit((s) => ({ ...s, multi: { ...s.multi, [group]: values }, page: 1 })),
    setSingle: (key, value) => commit((s) => ({ ...s, single: { ...s.single, [key]: value }, page: 1 })),
    setRange: (range) => commit((s) => ({ ...s, from: range?.from ?? null, to: range?.to ?? null, page: 1 })),
    clear: () => commit((s) => {
      const blank = emptyListState(spec);
      return { ...blank, single: { ...blank.single, ...Object.fromEntries(ignore.map((k) => [k, s.single[k] ?? null])) } };
    }),
  };
}
