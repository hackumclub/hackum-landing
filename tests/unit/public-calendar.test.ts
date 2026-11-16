// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { clubFeedIcs, eventIcs, feedForSegment, organizerEmail, personalFeedIcs } from "@/lib/public/calendar";
import { addEvent, addProfile, at, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
const reg = (eventId: string, profileId: string, status: Db["registrations"][number]["status"]) =>
  db.registrations.push({ id: `r_${eventId}_${profileId}`, event_id: eventId, profile_id: profileId, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-10), cancelled_at: null });
const uids = (ics: string) => [...ics.matchAll(/^UID:(.+)$/gm)].map((m) => m[1].trim()).sort();
const count = (ics: string) => (ics.match(/BEGIN:VEVENT/g) ?? []).length;

beforeEach(() => {
  db = emptyDb();
  addProfile(db, { id: "me", calendar_token: "tok_me" });
  addProfile(db, { id: "other", calendar_token: "tok_other" });
  addEvent(db, { id: "going", title: { mn: "Мэдлэг", en: "Knowledge" }, mode: "online", online_url: "https://meet.example.com/private" });
  addEvent(db, { id: "waitlisted" }); addEvent(db, { id: "cancelled-reg" }); addEvent(db, { id: "applied", reg_mode: "application" });
  addEvent(db, { id: "not-mine" }); addEvent(db, { id: "draft", status: "draft" }); addEvent(db, { id: "cancelled-event", status: "cancelled" });
  addEvent(db, { id: "past", status: "archived", starts_at: at(-100), ends_at: at(-98) });
  reg("going", "me", "going"); reg("waitlisted", "me", "waitlisted"); reg("cancelled-reg", "me", "cancelled"); reg("applied", "me", "applied");
  reg("not-mine", "other", "going"); reg("cancelled-event", "me", "going"); reg("draft", "me", "going");
});

describe("personal feed", () => {
  it("has a VEVENT only for events the person is going to", () => {
    const ics = personalFeedIcs(db, "tok_me", "en")!;
    expect(uids(ics)).toEqual(["going@hackum.club"]);
    expect(ics).toContain("METHOD:PUBLISH");
    expect(ics).toContain("SUMMARY:Knowledge");
  });

  it("leaves out cancelled registrations, waitlist, applications, drafts and cancelled events", () => {
    const ics = personalFeedIcs(db, "tok_me", "mn")!;
    for (const id of ["waitlisted", "cancelled-reg", "applied", "draft", "cancelled-event", "not-mine"]) expect(ics).not.toContain(`UID:${id}@`);
  });

  it("reveals the online link only inside that person's own feed", () => {
    expect(personalFeedIcs(db, "tok_me", "en")).toContain("meet.example.com/private");
    expect(eventIcs(db, "going-slug", "en")).not.toContain("meet.example.com");
    expect(clubFeedIcs(db, NOW, "en")).not.toContain("meet.example.com");
    expect(personalFeedIcs(db, "tok_other", "en")).not.toContain("meet.example.com");
  });

  it("returns null for unknown, empty and deleted-profile tokens", () => {
    db.profiles.find((p) => p.id === "other")!.deleted_at = at(-1);
    expect(personalFeedIcs(db, "nope", "en")).toBeNull();
    expect(personalFeedIcs(db, "", "en")).toBeNull();
    expect(personalFeedIcs(db, "tok_other", "en")).toBeNull();
  });

  it("an empty feed is still a valid calendar", () => {
    const ics = personalFeedIcs(db, "tok_other", "en")!;
    const none = personalFeedIcs(addDb(), "tok_x", "en")!;
    expect(count(none)).toBe(0);
    expect(none.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(count(ics)).toBe(1);
  });
});
function addDb() { const d = emptyDb(); addProfile(d, { id: "x", calendar_token: "tok_x" }); return d; }

describe("club feed", () => {
  it("lists upcoming published events only: no drafts, cancelled or past events", () => {
    const ics = clubFeedIcs(db, NOW, "en");
    expect(uids(ics)).toEqual(["applied", "cancelled-reg", "going", "not-mine", "waitlisted"].map((i) => `${i}@hackum.club`));
  });
});

describe("single event", () => {
  it("serves published, completed and archived events as METHOD:PUBLISH", () => {
    expect(eventIcs(db, "going-slug", "en")).toContain("METHOD:PUBLISH");
    expect(eventIcs(db, "past-slug", "en")).toContain("UID:past@hackum.club");
  });
  it("returns null for drafts, cancelled and unknown events", () => {
    for (const slug of ["draft-slug", "cancelled-event-slug", "unknown"]) expect(eventIcs(db, slug, "en")).toBeNull();
  });
  it("uses the organizer from EMAIL_ORGANIZER, defaulting to noreply@hackum.club", () => {
    delete process.env.EMAIL_ORGANIZER;
    expect(organizerEmail()).toBe("noreply@hackum.club");
    expect(eventIcs(db, "going-slug", "en")).toContain("ORGANIZER:mailto:noreply@hackum.club");
    process.env.EMAIL_ORGANIZER = "events@example.org";
    expect(eventIcs(db, "going-slug", "en")).toContain("ORGANIZER:mailto:events@example.org");
    delete process.env.EMAIL_ORGANIZER;
  });
  it("falls back to Mongolian when the English title is empty", () => {
    addEvent(db, { id: "mn-only", title: { mn: "Зөвхөн монгол", en: "" } });
    expect(eventIcs(db, "mn-only-slug", "en")).toContain("SUMMARY:Зөвхөн монгол");
  });
});

describe("feed segment", () => {
  it("routes club.ics and <token>.ics, and rejects everything else the same way", () => {
    expect(feedForSegment(db, "club.ics", NOW, "en")).toContain("BEGIN:VCALENDAR");
    expect(feedForSegment(db, "tok_me.ics", NOW, "en")).toContain("going@hackum.club");
    for (const bad of ["tok_me", "tok_me.ical", "nope.ics", ".ics", "club", "../tok_me.ics"]) expect(feedForSegment(db, bad, NOW, "en")).toBeNull();
  });
});
