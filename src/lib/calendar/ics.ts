// Minimal RFC 5545 writer. No library: we need exact control over folding (75 OCTETS, never inside a UTF-8 code point,
// so Mongolian Cyrillic and emoji survive) and over METHOD/SEQUENCE semantics for calendar clients.
export type IcsEvent = {
  uid: string;
  sequence: number;
  start: Date;
  end: Date;
  title: string;
  description: string;
  location: string;
  url: string;
  method: "REQUEST" | "CANCEL" | "PUBLISH";
  organizerEmail: string;
};

const CRLF = "\r\n";
const MAX_OCTETS = 75;

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** TEXT value escaping (RFC 5545 §3.3.11): backslash first, then , ; and line breaks. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\u005c;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

/** Strip control characters from values that are not escaped (UID, URL, email) so they cannot inject extra lines. */
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, "");

/** Fold a content line at 75 octets; continuation lines start with one space (which counts toward their 75). */
function fold(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= MAX_OCTETS) return line;
  const out: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    // `for…of` iterates code points, so a surrogate pair or multi-byte char is never split.
    const b = Buffer.byteLength(ch, "utf8");
    const limit = out.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join(CRLF + " ");
}

function vevent(e: IcsEvent, stamp: string): string[] {
  const l = [
    "BEGIN:VEVENT",
    `UID:${clean(e.uid)}`,
    `DTSTAMP:${stamp}`,
    `SEQUENCE:${Math.max(0, Math.trunc(e.sequence))}`,
    `DTSTART:${utc(e.start)}`,
    `DTEND:${utc(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
  ];
  if (e.description) l.push(`DESCRIPTION:${esc(e.description)}`);
  if (e.location) l.push(`LOCATION:${esc(e.location)}`);
  if (e.url) l.push(`URL:${clean(e.url)}`);
  if (e.organizerEmail) l.push(`ORGANIZER:mailto:${clean(e.organizerEmail)}`);
  l.push(`STATUS:${e.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`, "TRANSP:OPAQUE", "END:VEVENT");
  return l;
}

/** One VCALENDAR. The calendar METHOD is taken from the first event (a message carries a single method). */
export function buildIcs(events: IcsEvent[], calName?: string): string {
  const stamp = utc(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hackum//Hackum OS//EN", "CALSCALE:GREGORIAN", `METHOD:${events[0]?.method ?? "PUBLISH"}`];
  if (calName) lines.push(`X-WR-CALNAME:${esc(calName)}`);
  for (const e of events) lines.push(...vevent(e, stamp));
  lines.push("END:VCALENDAR");
  return lines.map(fold).join(CRLF) + CRLF;
}
