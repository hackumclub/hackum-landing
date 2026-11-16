import type { IcsEvent } from "@/lib/calendar/ics";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** "Add to Google Calendar" link. Dates are UTC so the instant is right in every time zone. */
export function googleCalendarUrl(e: Pick<IcsEvent, "title" | "start" | "end" | "description" | "location">): string {
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, details: e.description, location: e.location });
  // Google expects the literal "/" between the two instants, so it is appended instead of going through URLSearchParams.
  return `https://calendar.google.com/calendar/render?${p.toString()}&dates=${stamp(e.start)}/${stamp(e.end)}`;
}
