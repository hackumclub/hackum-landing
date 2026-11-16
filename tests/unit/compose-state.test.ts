// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BODY_MAX, SUBJECT_MAX, audienceForStatuses, audienceKey, composeHref, daysNeeded, daysSentence, parseComposeParams, parseDraft, serializeDraft, sendBlock, toAudience,
  type AudienceChoice,
} from "@/lib/announce/compose-state";

const EVENTS = ["e_1", "e_2"];
const none: AudienceChoice = { kind: null, eventId: "", statuses: [] };
const size = { total: 10, willReceive: 8, optedOut: 2 };
const ready = { subject: "Hi", body: "Hello", audience: { kind: "members", eventId: "", statuses: [] } as AudienceChoice, size };

describe("parseComposeParams", () => {
  it("reads a plain audience", () => {
    for (const k of ["members", "community", "everyone", "subscribers"] as const) expect(parseComposeParams({ audience: k }, EVENTS).kind).toBe(k);
  });
  it("falls back to no audience for anything unknown, missing or repeated", () => {
    expect(parseComposeParams({}, EVENTS)).toEqual(none);
    expect(parseComposeParams({ audience: "admins" }, EVENTS)).toEqual(none);
    expect(parseComposeParams({ audience: "__proto__" }, EVENTS)).toEqual(none);
    expect(parseComposeParams({ audience: ["members", "everyone"] }, EVENTS).kind).toBe("members");
    expect(parseComposeParams({ audience: undefined }, EVENTS)).toEqual(none);
  });
  it("event audience: known event and valid statuses, going by default", () => {
    expect(parseComposeParams({ audience: "event", event: "e_2", statuses: "going,waitlisted" }, EVENTS)).toEqual({ kind: "event", eventId: "e_2", statuses: ["going", "waitlisted"] });
    expect(parseComposeParams({ audience: "event", event: "e_1" }, EVENTS).statuses).toEqual(["going"]);
    expect(parseComposeParams({ audience: "event", event: "e_1", statuses: "rejected,cancelled,zzz,attended,attended" }, EVENTS).statuses).toEqual(["attended"]);
    expect(parseComposeParams({ audience: "event", event: "e_1", statuses: "nope" }, EVENTS).statuses).toEqual(["going"]);
  });
  it("event card stays selected but empty when the event id is unknown", () => {
    expect(parseComposeParams({ audience: "event", event: "gone" }, EVENTS)).toEqual({ kind: "event", eventId: "", statuses: ["going"] });
  });
});

describe("toAudience", () => {
  it("is null until the choice is complete", () => {
    expect(toAudience(none)).toBeNull();
    expect(toAudience({ kind: "event", eventId: "", statuses: ["going"] })).toBeNull();
    expect(toAudience({ kind: "event", eventId: "e_1", statuses: [] })).toBeNull();
  });
  it("maps to the domain audience, with statuses in canonical order", () => {
    expect(toAudience({ kind: "everyone", eventId: "x", statuses: ["going"] })).toEqual({ kind: "everyone" });
    expect(toAudience({ kind: "event", eventId: "e_1", statuses: ["attended", "going"] })).toEqual({ kind: "event", eventId: "e_1", statuses: ["going", "attended"] });
  });
  it("audienceKey is stable for equal audiences", () => {
    expect(audienceKey({ kind: "event", eventId: "e_1", statuses: ["going", "applied"] })).toBe(audienceKey({ kind: "event", eventId: "e_1", statuses: ["going", "applied"] }));
    expect(audienceKey({ kind: "members" })).not.toBe(audienceKey({ kind: "community" }));
  });
});

describe("sendBlock: why Send is disabled", () => {
  it("is null when everything is valid", () => expect(sendBlock(ready)).toBeNull());
  it("names the first thing missing, audience before text", () => {
    expect(sendBlock({ ...ready, audience: none, subject: "", body: "" })).toBe("audience");
    expect(sendBlock({ ...ready, audience: { kind: "event", eventId: "", statuses: ["going"] } })).toBe("event");
    expect(sendBlock({ ...ready, audience: { kind: "event", eventId: "e_1", statuses: [] } })).toBe("statuses");
    expect(sendBlock({ ...ready, subject: "  " })).toBe("subject");
    expect(sendBlock({ ...ready, body: "\n\n" })).toBe("body");
  });
  it("limits", () => {
    expect(sendBlock({ ...ready, subject: "x".repeat(SUBJECT_MAX) })).toBeNull();
    expect(sendBlock({ ...ready, subject: "x".repeat(SUBJECT_MAX + 1) })).toBe("subjectLong");
    expect(sendBlock({ ...ready, body: "x".repeat(BODY_MAX + 1) })).toBe("bodyLong");
    expect(sendBlock({ ...ready, subjectEn: "x".repeat(SUBJECT_MAX + 1) })).toBe("subjectLong");
    expect(sendBlock({ ...ready, bodyEn: "x".repeat(BODY_MAX + 1) })).toBe("bodyLong");
  });
  it("blocks a repeat of a message that has just been sent", () => {
    expect(sendBlock({ ...ready, sent: true })).toBe("sent");
    expect(sendBlock({ ...ready, sent: false })).toBeNull();
  });
  it("waits for the count and refuses an empty audience", () => {
    expect(sendBlock({ ...ready, size: null })).toBe("counting");
    expect(sendBlock({ ...ready, size: { total: 3, willReceive: 0, optedOut: 3 } })).toBe("nobody");
  });
});

describe("daysNeeded and daysSentence", () => {
  it("rounds up per free-plan day, at least one", () => {
    expect(daysNeeded(0, 80)).toBe(1);
    expect(daysNeeded(80, 80)).toBe(1);
    expect(daysNeeded(81, 80)).toBe(2);
    expect(daysNeeded(142, 80)).toBe(2);
    expect(daysNeeded(500, 80)).toBe(7);
    expect(daysNeeded(10, 0)).toBe(1); // never divide by zero
  });
  const c = { one: "Goes out today. Up to {perDay} emails a day, {reserved} kept for confirmations.", other: "About {days} days: {perDay} emails go out per day, {reserved} are kept for confirmations." };
  it("says it plainly", () => {
    expect(daysSentence(142, { perDay: 80, reserved: 20 }, c)).toBe("About 2 days: 80 emails go out per day, 20 are kept for confirmations.");
    expect(daysSentence(5, { perDay: 80, reserved: 20 }, c)).toBe("Goes out today. Up to 80 emails a day, 20 kept for confirmations.");
  });
});

describe("drafts", () => {
  it("round trips", () => {
    const d = { subject: { mn: "a", en: "b" }, body: { mn: "c", en: "d" }, audience: { kind: "event" as const, eventId: "e_1", statuses: ["going" as const] } };
    expect(parseDraft(serializeDraft(d))).toEqual(d);
  });
  it("rejects anything odd instead of throwing", () => {
    for (const raw of [null, "", "{", "[]", "null", '{"subject":1}', '{"subject":{"mn":"a","en":"b"},"body":{"mn":"c"}}']) expect(parseDraft(raw)).toBeNull();
  });
  it("clamps absurd text and drops unknown audience values", () => {
    const raw = JSON.stringify({ subject: { mn: "x".repeat(999), en: "" }, body: { mn: "y".repeat(30_000), en: "" }, audience: { kind: "weird", eventId: 5, statuses: ["going", "bogus"] } });
    const d = parseDraft(raw)!;
    expect(d.subject.mn).toHaveLength(999);
    expect(d.body.mn).toHaveLength(20_000);
    expect(d.audience).toEqual({ kind: null, eventId: "", statuses: ["going"] });
  });
});

describe("entry-point links", () => {
  it("the members-list filter picks the matching audience", () => {
    expect(audienceForStatuses([])).toBe("members");
    expect(audienceForStatuses(["member"])).toBe("members");
    expect(audienceForStatuses(["member", "alumni"])).toBe("community");
    expect(audienceForStatuses(["alumni"])).toBe("community");
    expect(audienceForStatuses(["guest"])).toBe("everyone");
    expect(audienceForStatuses(["member", "alumni", "guest"])).toBe("everyone");
  });
  it("composeHref builds links parseComposeParams reads back", () => {
    expect(composeHref("en")).toBe("/en/admin/comms/new?audience=members");
    const q = new URL(composeHref("mn", { audience: "event", eventId: "e_7", statuses: ["going", "waitlisted"] }), "http://x").searchParams;
    expect(parseComposeParams(Object.fromEntries(q), ["e_7"])).toEqual({ kind: "event", eventId: "e_7", statuses: ["going", "waitlisted"] });
  });
});
