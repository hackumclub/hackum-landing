// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { guardDecision } from "@/lib/guard";
import type { Db } from "@/lib/mockdb/types";
import { addEvent, addProfile, addStaff, emptyDb } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "boss", "admin");
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "mem" });
  addProfile(db, { id: "gone", deleted_at: "2026-01-01T00:00:00Z" });
  addEvent(db, { id: "e_7" });
  db.polls.push({ id: "poll_3", title: { mn: "а", en: "a" }, description: { mn: "", en: "" }, options: [], multi: false, max_choices: 1, audience: "members", anonymous: false, results: "after_vote", opens_at: null, closes_at: null, status: "draft", created_by: null, created_at: "2026-01-01T00:00:00Z" });
  db.forms.push({ id: "join", kind: "join", title: { mn: "j", en: "j" }, questions: [], updated_at: "2026-01-01T00:00:00Z", updated_by: null });
  db.forms.push({ id: "membership_application", kind: "membership_application", title: { mn: "m", en: "m" }, questions: [], updated_at: "2026-01-01T00:00:00Z", updated_by: null });
});
const run = (pathname: string, handle: string | undefined, search = "") => guardDecision({ pathname, search, handle, db });

describe("guardDecision (proxy route guard, cookie + role lookup; the pages re-check)", () => {
  it("leaves public paths and unknown areas alone", () => {
    for (const p of ["/en", "/en/events", "/en/sign-in", "/mn/administrator", "/en/menu"]) expect(run(p, undefined), p).toEqual({ type: "pass" });
  });
  it("redirects signed-out visitors of /me and /admin to sign-in with next (query kept)", () => {
    expect(run("/en/admin/events", undefined)).toEqual({ type: "redirect", lang: "en", next: "/en/admin/events" });
    expect(run("/mn/me", undefined)).toEqual({ type: "redirect", lang: "mn", next: "/mn/me" });
    expect(run("/en/me/events", undefined, "?tab=going")).toEqual({ type: "redirect", lang: "en", next: "/en/me/events?tab=going" });
  });
  it("a hostile path never changes where the redirect goes: only the fixed sign-in page, `next` stays data", () => {
    for (const p of ["/en/admin//evil.com", "/en/me/%2F%2Fevil.com", "/en/me//evil.com", "/en/admin/\\evil.com"]) {
      const d = run(p, undefined);
      expect(d, p).toEqual({ type: "redirect", lang: "en", next: p });
      expect(Object.keys(d).sort(), p).toEqual(["lang", "next", "type"]); // no URL string for the proxy to follow
    }
  });
  it("treats a cookie for an unknown or deleted profile as signed out", () => {
    expect(run("/en/admin", "nobody").type).toBe("redirect");
    expect(run("/en/me", "gone").type).toBe("redirect");
  });
  it("answers 404 for signed-in non-staff on /admin, but lets them use /me", () => {
    expect(run("/en/admin", "mem")).toEqual({ type: "notFound" });
    expect(run("/en/admin/events/e_1/registrations", "mem")).toEqual({ type: "notFound" });
    expect(run("/en/me", "mem")).toEqual({ type: "pass" });
  });
  it("answers 404 for an organizer on admin-only areas, never on the rest", () => {
    for (const p of ["/en/admin/settings", "/en/admin/settings/staff", "/en/admin/audit"]) expect(run(p, "org"), p).toEqual({ type: "notFound" });
    for (const p of ["/en/admin", "/en/admin/events", "/en/admin/members/merge", "/en/admin/inbox", "/en/admin/settingsx"]) expect(run(p, "org"), p).toEqual({ type: "pass" });
  });
  it("lets the admin through everywhere", () => {
    for (const p of ["/en/admin", "/en/admin/settings/staff", "/en/admin/audit", "/en/me"]) expect(run(p, "boss"), p).toEqual({ type: "pass" });
  });

  it("answers 404 for an unknown form id for staff (F-05), but not for real forms or an event form", () => {
    for (const p of ["/en/admin/forms/nope", "/en/admin/forms/event%3Ae_999", "/en/admin/forms/event:e_999", "/mn/admin/forms/%E0%A4%A"]) expect(run(p, "org"), p).toEqual({ type: "notFound" });
    for (const p of ["/en/admin/forms", "/en/admin/forms/join", "/en/admin/forms/membership_application", "/en/admin/forms/event%3Ae_7", "/en/admin/forms/event:e_7", "/en/admin/forms/join/"]) expect(run(p, "org"), p).toEqual({ type: "pass" });
  });
  it("still sends signed-out visitors of a form id to sign-in, and non-staff to 404", () => {
    expect(run("/en/admin/forms/nope", undefined).type).toBe("redirect");
    expect(run("/en/admin/forms/join", "mem")).toEqual({ type: "notFound" });
  });
});

describe("unknown event ids in the backoffice (F-05)", () => {
  it("answers 404 for an unknown event id on every event sub-page, for staff", () => {
    for (const p of ["/en/admin/events/nope", "/en/admin/events/e_999/registrations", "/mn/admin/events/e_999/comms", "/en/admin/events/e_999/analytics", "/en/admin/events/%E0%A4%A"]) expect(run(p, "org"), p).toEqual({ type: "notFound" });
  });
  it("lets real events, the list and the new-event page through", () => {
    for (const p of ["/en/admin/events", "/en/admin/events/new", "/en/admin/events/e_7", "/en/admin/events/e_7/registrations", "/en/admin/events/e_7/"]) expect(run(p, "org"), p).toEqual({ type: "pass" });
  });
  it("still redirects signed-out visitors and 404s non-staff before looking at the id", () => {
    expect(run("/en/admin/events/e_999", undefined).type).toBe("redirect");
    expect(run("/en/admin/events/e_7", "mem")).toEqual({ type: "notFound" });
  });
});

describe("unknown poll id (A2)", () => {
  it("answers 404 for staff on an unknown or malformed poll id, passes real ids, the list and the create page", () => {
    for (const p of ["/en/admin/polls/nope", "/mn/admin/polls/poll_999", "/en/admin/polls/%E0%A4%A", "/en/admin/polls/poll_3x"]) expect(run(p, "org"), p).toEqual({ type: "notFound" });
    for (const p of ["/en/admin/polls", "/en/admin/polls/new", "/en/admin/polls/poll_3", "/mn/admin/polls/poll_3/"]) expect(run(p, "org"), p).toEqual({ type: "pass" });
  });
  it("signed-out visitors still go to sign-in and non-staff get the ordinary 404", () => {
    expect(run("/en/admin/polls/nope", undefined).type).toBe("redirect");
    expect(run("/en/admin/polls/poll_3", "mem")).toEqual({ type: "notFound" });
  });
});
