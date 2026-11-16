/** Error codes shared by server actions, mock RPCs and (later) Supabase RPCs (`raise exception … message = '<code>'`). */
export type ErrorCode = "unauthenticated" | "forbidden" | "not_found" | "invalid" | "conflict" | "full" | "closed" | "rate_limited" | "ineligible" | "server";
export type Result<T, E extends string = ErrorCode> = { ok: true; data: T } | { ok: false; error: E };
export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
export const err = <E extends ErrorCode>(error: E): Result<never, E> => ({ ok: false, error });
