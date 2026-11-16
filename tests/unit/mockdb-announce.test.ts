// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { audienceSize, resolveAudience, sendAnnouncement, type AnnouncementInput } from "@/lib/mockdb/announce";
import { dispatchOutbox, DAILY_LIMIT, RESERVED_FOR_TRANSACTIONAL } from "@/lib/mockdb/outbox";
import { inboxFor } from "@/lib/mockdb/notifications";
import type { RegStatus } from "@/lib/status";
import { addEvent, addProfile, addStaff, at, ctx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
const reg = (event_id: string, profile_id: string, status: RegStatus) =>
  db.registrations.push({ id: `r${db.registrations.length}`, event_id, profile_id, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-50), cancelled_at: null });
const msg = (over: Partial<AnnouncementInput> = {}): AnnouncementInput => ({
  key: "k1", audience: { kind: "members" }, subject: { mn: "Шинэ мэдээ", en: "News" }, body: { mn: "Сайн уу, гишүүд ээ.\n\nУулзалт пүрэв гарагт.", en: "Hello members.\n\nMeetup on Thursday." }, ...over,
});
const send = (actor: string | null, input = msg(), now: Date = NOW) => sendAnnouncement(ctx(db, actor, now), input);

beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "m1", status: "member" }); addProfile(db, { id: "m2", status: "member" }); addProfile(db, { id: "m3", status: "member" });
  addProfile(db, { id: "al", status: "alumni" }); addProfile(db, { id: "g1", status: "guest" });
  addProfile(db, { id: "gone", status: "member", deleted_at: at(-5) }); addProfile(db, { id: "fresh", status: "member", onboarded_at: null });
  db.profiles.find((p) => p.id === "m3")!.notif_prefs.announcements = false;
  db.subscribers.push({ email: "news@example.com", name: "N", lang: "mn", source: "footer", created_at: at(-9) }, { email: "m1@example.com", name: "Same person", lang: "en", source: "footer", created_at: at(-9) });
  addEvent(db, { id: "e1" });
  reg("e1", "m1", "going"); reg("e1", "g1", "going"); reg("e1", "al", "waitlisted"); reg("e1", "m2", "cancelled");
});

describe("audiences", () => {
  it("members = onboarded members; community adds alumni; everyone = every onboarded account; deleted people never", () => {
    const ids = (a: AnnouncementInput["audience"]) => resolveAudience(db, a).filter((r) => r.profile_id).map((r) => r.profile_id).sort();
    expect(ids({ kind: "members" })).toEqual(["m1", "m2", "m3"]);
    expect(ids({ kind: "community" })).toEqual(["al", "m1", "m2", "m3"]);
    expect(ids({ kind: "everyone" })).toEqual(["al", "g1", "m1", "m2", "m3", "org"]);
  });
  it("subscribers = newsletter addresses that are not already an account (no double mail)", () => {
    expect(resolveAudience(db, { kind: "subscribers" })).toEqual([{ email: "news@example.com", lang: "mn", name: "N" }]);
  });
  it("event audience follows registration status, never cancelled", () => {
    expect(resolveAudience(db, { kind: "event", eventId: "e1", statuses: ["going"] }).map((r) => r.profile_id).sort()).toEqual(["g1", "m1"]);
    expect(resolveAudience(db, { kind: "event", eventId: "e1", statuses: ["going", "waitlisted", "cancelled" as never] }).map((r) => r.profile_id).sort()).toEqual(["al", "g1", "m1"]);
    expect(resolveAudience(db, { kind: "event", eventId: "nope", statuses: ["going"] })).toEqual([]);
  });
  it("audienceSize reports who will actually get it and who opted out", () => {
    expect(audienceSize(db, { kind: "members" })).toEqual({ total: 3, willReceive: 2, optedOut: 1 });
  });
});

describe("sendAnnouncement", () => {
  it("is staff only", () => {
    expect(send("m1")).toEqual({ ok: false, error: "forbidden" });
    expect(send(null)).toEqual({ ok: false, error: "unauthenticated" });
  });
  it("queues one email and one in-app item per person who has not opted out, with both languages", () => {
    const r = send("org");
    expect(r).toMatchObject({ ok: true, data: { queued: 2, optedOut: 1 } });
    const rows = db.notifications.filter((n) => n.template === "announcement");
    expect(rows.map((n) => n.profile_id).sort()).toEqual(["m1", "m2"]);
    expect(rows[0]).toMatchObject({ priority: 2, status: "queued", payload: { subject_mn: "Шинэ мэдээ", subject_en: "News" } });
    expect(rows[0].payload.body_mn).toContain("пүрэв");
    expect(inboxFor(db, "m1", {}).some((i) => i.kind === "announcement")).toBe(true);
    expect(inboxFor(db, "m3", {})).toHaveLength(0);
  });
  it("mails newsletter subscribers by address", () => {
    const r = send("org", msg({ audience: { kind: "subscribers" } }));
    expect(r).toMatchObject({ ok: true, data: { queued: 1 } });
    expect(db.notifications.find((n) => n.to_email === "news@example.com")).toMatchObject({ profile_id: null, template: "announcement", priority: 2 });
  });
  it("a double click (same key) queues nothing the second time", () => {
    send("org"); const again = send("org");
    expect(again).toMatchObject({ ok: true, data: { queued: 0 } });
    expect(db.notifications.filter((n) => n.template === "announcement")).toHaveLength(2);
  });
  it("tells staff how many days the free daily limit means, and the dispatcher respects the reserved slots", () => {
    for (let i = 0; i < 170; i++) addProfile(db, { id: `x${i}`, status: "member" });
    const r = send("org");
    if (!r.ok) throw new Error(r.error);
    expect(r.data.queued).toBe(172);
    expect(r.data.days).toBe(Math.ceil(172 / (DAILY_LIMIT - RESERVED_FOR_TRANSACTIONAL)));
    const out = dispatchOutbox(db, NOW, { limit: 500 });
    expect(out.sent).toBe(DAILY_LIMIT - RESERVED_FOR_TRANSACTIONAL);
    expect(out.deferred).toBeGreaterThan(0);
  });
  it("validates the message and the audience before writing anything", () => {
    for (const bad of [msg({ subject: { mn: " ", en: "x" } }), msg({ body: { mn: "", en: "" } }), msg({ subject: { mn: "x".repeat(121), en: "" } }), msg({ body: { mn: "x".repeat(5001), en: "" } }), msg({ key: "" }), msg({ audience: { kind: "event", eventId: "nope", statuses: ["going"] } }), msg({ audience: { kind: "event", eventId: "e1", statuses: [] } })]) {
      expect(send("org", bad)).toEqual({ ok: false, error: "invalid" });
    }
    expect(db.notifications).toHaveLength(0);
  });
  it("is limited to 5 announcements an hour per sender", () => {
    for (let i = 0; i < 5; i++) expect(send("org", msg({ key: `k${i}` }), new Date(NOW.getTime() + i * 60_000)).ok).toBe(true);
    expect(send("org", msg({ key: "k9" }), new Date(NOW.getTime() + 10 * 60_000))).toEqual({ ok: false, error: "rate_limited" });
    expect(send("org", msg({ key: "k10" }), new Date(NOW.getTime() + 61 * 60_000)).ok).toBe(true);
  });
  it("audits who sent what to whom, without the body", () => {
    send("org");
    const a = db.audit_log.at(-1)!;
    expect(a).toMatchObject({ action: "announcement.send", actor_profile_id: "org" });
    expect(JSON.stringify(a.diff)).not.toContain("пүрэв");
  });
});
