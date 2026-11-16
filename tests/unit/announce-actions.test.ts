// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ctx, Db } from "@/lib/mockdb/types";
import { err, type Result } from "@/lib/result";
import { announceMessage } from "@/lib/announce/errors";
import { copy } from "@/lib/announce/copy";
import { addEvent, addProfile, addStaff, at, emptyDb, NOW } from "./helpers/fixture";

// The session module reads cookies and the real store; the action's own logic is what is under test here.
let db: Db;
let actor: string | null;
vi.mock("@/lib/server/session", () => ({
  requireStaffAction: async () => {
    if (!actor) return err("unauthenticated");
    const role = db.staff_roles.find((r) => r.profile_id === actor)?.role ?? null;
    return role ? { ok: true, data: { profileId: actor, staffRole: role } } : err("forbidden");
  },
  act: async <T,>(rule: (ctx: Ctx) => Result<T>) => rule({ db, actor, now: NOW }),
}));
vi.mock("@/lib/mockdb/store", () => ({ getStore: () => ({ read: () => db }) }));
const { sendAnnouncementAction, audienceSizeAction, previewAnnouncementAction } = await import("@/lib/announce/actions");

const valid = (over: Record<string, unknown> = {}) => ({
  key: "k-1", audience: { kind: "members" }, subject: { mn: "Шинэ мэдээ", en: "News" }, body: { mn: "Сайн уу\n\nБаяртай", en: "Hello\n\nBye" }, ...over,
});
const rows = () => db.notifications.filter((n) => n.template === "announcement");

beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addStaff(db, "adm", "admin");
  addProfile(db, { id: "mem", status: "member" });
  addProfile(db, { id: "m2", status: "member" });
  addProfile(db, { id: "m3", status: "member" });
  db.profiles.find((p) => p.id === "m3")!.notif_prefs.announcements = false;
  db.subscribers.push({ email: "news@example.com", name: "N", lang: "mn", source: "footer", created_at: at(-9) });
  addEvent(db, { id: "e1" });
  db.registrations.push({ id: "r1", event_id: "e1", profile_id: "mem", status: "going", source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: at(-50), cancelled_at: null });
  actor = "org";
});

describe("authorisation matrix", () => {
  it.each([["org", true], ["adm", true], ["mem", false], [null, false]] as const)("send / size / preview as %s → ok=%s", async (who, ok) => {
    actor = who;
    expect((await sendAnnouncementAction(valid())).ok).toBe(ok);
    expect((await audienceSizeAction({ kind: "members" })).ok).toBe(ok);
    expect((await previewAnnouncementAction({ subject: { mn: "a", en: "" }, body: { mn: "b", en: "" }, lang: "mn" })).ok).toBe(ok);
    if (!ok) expect(rows()).toHaveLength(0);
  });
  it("a member gets forbidden and a signed-out caller unauthenticated", async () => {
    actor = "mem";
    expect(await sendAnnouncementAction(valid())).toEqual({ ok: false, error: "forbidden" });
    expect(await audienceSizeAction({ kind: "members" })).toEqual({ ok: false, error: "forbidden" });
    actor = null;
    expect(await sendAnnouncementAction(valid())).toEqual({ ok: false, error: "unauthenticated" });
  });
});

describe("zod rejects bad payloads before the rule runs", () => {
  it.each([
    ["null", null],
    ["string", "hello"],
    ["no key", { ...valid(), key: undefined }],
    ["blank key", valid({ key: "  " })],
    ["key too long", valid({ key: "k".repeat(65) })],
    ["unknown audience", valid({ audience: { kind: "admins" } })],
    ["event without id", valid({ audience: { kind: "event", statuses: ["going"] } })],
    ["event with no statuses", valid({ audience: { kind: "event", eventId: "e1", statuses: [] } })],
    ["rejected is not a mailable status", valid({ audience: { kind: "event", eventId: "e1", statuses: ["rejected"] } })],
    ["blank Mongolian subject", valid({ subject: { mn: "   ", en: "x" } })],
    ["subject over 120", valid({ subject: { mn: "x".repeat(121), en: "" } })],
    ["body over 5000", valid({ body: { mn: "x".repeat(5001), en: "" } })],
    ["english body over 5000", valid({ body: { mn: "x", en: "x".repeat(5001) } })],
    ["extra field", valid({ audience: { kind: "members", extra: true } })],
    ["subject not bilingual", valid({ subject: "News" })],
  ])("%s → invalid, nothing queued", async (_name, input) => {
    expect(await sendAnnouncementAction(input)).toEqual({ ok: false, error: "invalid" });
    expect(rows()).toHaveLength(0);
  });
  it("audience size and preview validate too", async () => {
    expect(await audienceSizeAction({ kind: "nope" })).toEqual({ ok: false, error: "invalid" });
    expect(await audienceSizeAction(undefined)).toEqual({ ok: false, error: "invalid" });
    expect(await previewAnnouncementAction({ subject: { mn: "a", en: "" }, body: { mn: "b", en: "" }, lang: "de" })).toEqual({ ok: false, error: "invalid" });
  });
});

describe("sending", () => {
  it("queues one email per recipient who has not opted out and reports the numbers", async () => {
    const r = await sendAnnouncementAction(valid());
    expect(r).toEqual({ ok: true, data: { queued: 2, optedOut: 1, days: 1 } });
    expect(rows().map((n) => n.profile_id).sort()).toEqual(["m2", "mem"]);
  });
  it("sends to an event's attendees by status", async () => {
    const r = await sendAnnouncementAction(valid({ audience: { kind: "event", eventId: "e1", statuses: ["going"] } }));
    expect(r).toMatchObject({ ok: true, data: { queued: 1 } });
    expect(rows().map((n) => n.profile_id)).toEqual(["mem"]);
  });
  it("an unknown event is a rule error, not a crash", async () => {
    expect(await sendAnnouncementAction(valid({ audience: { kind: "event", eventId: "nope", statuses: ["going"] } }))).toEqual({ ok: false, error: "invalid" });
  });
  it("double submit with the same key queues once", async () => {
    await sendAnnouncementAction(valid());
    const again = await sendAnnouncementAction(valid());
    expect(again).toMatchObject({ ok: true, data: { queued: 0 } });
    expect(rows()).toHaveLength(2);
  });
  it("a fresh key is a new announcement", async () => {
    await sendAnnouncementAction(valid());
    await sendAnnouncementAction(valid({ key: "k-2" }));
    expect(rows()).toHaveLength(4);
  });
  it("the sixth announcement within an hour is rate limited", async () => {
    for (let i = 0; i < 5; i++) expect((await sendAnnouncementAction(valid({ key: `k-${i}` }))).ok).toBe(true);
    expect(await sendAnnouncementAction(valid({ key: "k-6" }))).toEqual({ ok: false, error: "rate_limited" });
  });
  it("never writes the subject, body or an address to the log", async () => {
    const lines: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((l: unknown) => { lines.push(String(l)); });
    await sendAnnouncementAction(valid({ audience: { kind: "subscribers" } }));
    spy.mockRestore();
    const out = lines.join("\n");
    expect(out).not.toContain("Шинэ мэдээ");
    expect(out).not.toContain("Сайн уу");
    expect(out).not.toContain("news@example.com");
  });
});

describe("audienceSizeAction", () => {
  it("returns the live counts and the free-plan numbers", async () => {
    const r = await audienceSizeAction({ kind: "members" });
    expect(r).toEqual({ ok: true, data: { total: 3, willReceive: 2, optedOut: 1, perDay: 80, reserved: 20 } });
  });
  it("counts an event audience by status, and an empty one as zero", async () => {
    expect(await audienceSizeAction({ kind: "event", eventId: "e1", statuses: ["going"] })).toMatchObject({ ok: true, data: { total: 1, willReceive: 1 } });
    expect(await audienceSizeAction({ kind: "event", eventId: "e1", statuses: ["waitlisted"] })).toMatchObject({ ok: true, data: { total: 0 } });
  });
  it("does not change anything", async () => {
    const before = JSON.stringify(db);
    await audienceSizeAction({ kind: "everyone" });
    expect(JSON.stringify(db)).toBe(before);
  });
});

describe("previewAnnouncementAction", () => {
  it("renders the real announcement email in the chosen language, escaped", async () => {
    const r = await previewAnnouncementAction({ subject: { mn: "Мэдээ <b>", en: "News & more" }, body: { mn: "Нэг\n\nХоёр", en: "One\n\nTwo" }, lang: "en" });
    if (!r.ok) throw new Error(r.error);
    expect(r.data.subject).toBe("News & more");
    expect(r.data.html).toContain("News &amp; more");
    expect(r.data.html).toContain(">One<");
    expect(r.data.html).toContain(">Two<");
    expect(r.data.html).not.toContain("<b>");
  });
  it("English falls back to Mongolian when the translation is empty", async () => {
    const r = await previewAnnouncementAction({ subject: { mn: "Монгол гарчиг", en: "" }, body: { mn: "Монгол", en: "" }, lang: "en" });
    expect(r).toMatchObject({ ok: true, data: { subject: "Монгол гарчиг" } });
  });
});

describe("error mapping", () => {
  it("maps every code to a sentence, never to the code", () => {
    for (const lang of ["mn", "en"] as const) {
      for (const code of ["unauthenticated", "forbidden", "not_found", "invalid", "conflict", "rate_limited", "ineligible", "full", "closed", "server", "network"] as const) {
        const m = announceMessage(code, lang);
        expect(m.length).toBeGreaterThan(10);
        expect(m).not.toBe(code);
        expect(m).not.toMatch(/^[a-z_]+$/);
      }
    }
  });
  it("rate_limited says the limit plainly", () => {
    expect(announceMessage("rate_limited", "en")).toBe("You can send 5 announcements an hour");
    expect(announceMessage("forbidden", "en")).toBe(copy.en.errors.forbidden);
  });
});
