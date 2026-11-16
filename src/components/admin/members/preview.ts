import "server-only";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * `?state=error|slow` previews the error and loading states of a page in development (ignored in production), the same
 * convention the dashboard uses. "slow" holds the content back for 1.5s so the skeleton can be looked at and tested.
 */
export async function previewState(searchParams: SearchParams): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const state = (await searchParams).state;
  if (state === "slow") await new Promise((r) => setTimeout(r, 1500));
  if (state === "error") throw new Error("Preview of the error state (?state=error)");
}
