import { connection } from "next/server";
import { getStore, mockEnabled } from "@/lib/mockdb/store";

/** Server-sent events: one message per change to the mock db ({ v: version }). Local mock mode only. */
export async function GET(req: Request) {
  await connection();
  if (!mockEnabled()) return new Response(null, { status: 404 });
  const store = getStore();
  const enc = new TextEncoder();
  let off = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stop = () => { off(); if (heartbeat) clearInterval(heartbeat); };
  const stream = new ReadableStream({
    start(controller) {
      const send = (v: number) => controller.enqueue(enc.encode(`data: ${JSON.stringify({ v })}\n\n`));
      send(store.version());
      off = store.subscribe(send);
      heartbeat = setInterval(() => controller.enqueue(enc.encode(": keep-alive\n\n")), 15_000);
      req.signal.addEventListener("abort", () => { stop(); try { controller.close(); } catch { /* already closed */ } });
    },
    cancel: stop,
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" } });
}
