import { notFound } from "next/navigation";
import { getStore } from "@/lib/mockdb/store";

/** The event by id from the (mock) store, or the ordinary 404. Call after requireStaffPage() and inside Suspense. */
export function loadEvent(id: string) {
  const store = getStore();
  const db = store.read();
  const event = db.events.find((e) => e.id === id);
  if (!event) notFound();
  return { db, event, now: store.now() };
}
