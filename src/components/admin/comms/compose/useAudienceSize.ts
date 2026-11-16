"use client";
import { useEffect, useState } from "react";
import { audienceKey } from "@/lib/announce/compose-state";
import { audienceSizeAction, type SizeOutcome } from "@/lib/announce/actions";
import type { AnnounceAudience } from "@/lib/mockdb/announce";

export type SizeState = { status: "idle" } | { status: "loading" } | { status: "ready"; size: SizeOutcome } | { status: "error" };

const DEBOUNCE_MS = 250;

/**
 * Live count for an audience. Waits 250 ms after the last change, and ignores any answer that is not for the audience
 * currently shown (server actions cannot be cancelled, so a stale result is dropped instead of aborted).
 * `loading` is derived (the stored answer belongs to another audience), so no state is set synchronously in the effect.
 */
export function useAudienceSize(audience: AnnounceAudience | null): SizeState {
  const key = audience ? audienceKey(audience) : null;
  const [answer, setAnswer] = useState<{ key: string; state: SizeState } | null>(null);

  useEffect(() => {
    if (!audience || !key) return;
    let live = true;
    const timer = setTimeout(() => {
      audienceSizeAction(audience)
        .then((r) => { if (live) setAnswer({ key, state: r.ok ? { status: "ready", size: r.data } : { status: "error" } }); })
        .catch(() => { if (live) setAnswer({ key, state: { status: "error" } }); });
    }, DEBOUNCE_MS);
    return () => { live = false; clearTimeout(timer); };
    // `audience` is fully described by `key`; depending on the object would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { status: "idle" };
  return answer && answer.key === key ? answer.state : { status: "loading" };
}
