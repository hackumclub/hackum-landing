// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db, Notification } from "@/lib/mockdb/types";
import { dispatchOutbox, enqueueDueReminders } from "@/lib/mockdb/outbox";
import { registerForEvent } from "@/lib/mockdb/registrations";
import { addEvent, addProfile, at, ctx, emptyDb, NOW } from "./helpers/fixture";
import { ubDay } from "@/lib/mockdb/core";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  for (const id of ["a", "b"]) addProfile(db, { id });
});
const going = (event: string, ...ids: string[]) => { for (const id of ids) registerForEvent(ctx(db, id, new Date(NOW.getTime() - 3_600_000)), { eventId: event, answers: {} }); };
const row = (over: Partial<Notification> & { id: string }): Notification => ({
  profile_id: "a", to_email: null, channel: "email", template: "announcement", payload: {}, priority: 2, scheduled_at: at(-1), status: "queued", attempts: 0,
  last_error: null, dedupe_key: over.id, sent_at: null, ...over,
});
const status = (id: string) => db.notifications.find((n) => n.id === id)!.status;

describe("24-hour reminders", () => {
  it("queues one reminder per person going to an event starting in about a day, exactly once", () => {
    addEvent(db, { id: "soon", starts_at: at(24), ends_at: at(26) }); addEvent(db, { id: "later", starts_at: at(24 * 5), ends_at: at(24 * 5 + 2) });
    going("soon", "a", "b"); going("later", "a");
    db.notifications.length = 0;
    expect(enqueueDueReminders(db, NOW)).toBe(2);
    expect(enqueueDueReminders(db, NOW)).toBe(0);
    expect(db.notifications.map((n) => n.template)).toEqual(["reminder_24h", "reminder_24h"]);
    expect(db.notifications[0]).toMatchObject({ priority: 1, status: "queued" });
  });
  it("ignores people who are only waitlisted and events that are not published", () => {
    addEvent(db, { id: "e1", starts_at: at(24), ends_at: at(26), capacity: 1 }); going("e1", "a", "b");
    addEvent(db, { id: "d1", starts_at: at(24), ends_at: at(26), status: "draft" });
    db.notifications.length = 0;
    expect(enqueueDueReminders(db, NOW)).toBe(1);
  });
});

describe("dispatchOutbox", () => {
  it("sends due messages in priority order and counts them against today's budget", () => {
    db.notifications.push(row({ id: "n1", priority: 2 }), row({ id: "n2", priority: 0, template: "rsvp_confirmed" }), row({ id: "future", scheduled_at: at(5) }));
    const r = dispatchOutbox(db, NOW);
    expect(r).toMatchObject({ sent: 2, skipped: 0, failed: 0, deferred: 0 });
    expect(status("n2")).toBe("sent"); expect(status("n1")).toBe("sent"); expect(status("future")).toBe("queued");
    expect(db.notifications.find((n) => n.id === "n2")!.sent_at).not.toBeNull();
    expect(db.email_daily_usage[ubDay(NOW)]).toBe(2);
  });
  it("keeps 20 sends a day in reserve for transactional mail", () => {
    db.email_daily_usage[ubDay(NOW)] = 85;
    db.notifications.push(row({ id: "promo", priority: 2 }), row({ id: "tx", priority: 0, template: "rsvp_confirmed" }));
    expect(dispatchOutbox(db, NOW)).toMatchObject({ sent: 1, deferred: 1 });
    expect(status("tx")).toBe("sent"); expect(status("promo")).toBe("queued");
    db.email_daily_usage[ubDay(NOW)] = 100;
    db.notifications.push(row({ id: "tx2", priority: 0, template: "rsvp_confirmed" }));
    expect(dispatchOutbox(db, NOW)).toMatchObject({ sent: 0, deferred: 2 });
  });
  it("skips mail whose context has changed: cancelled events, left registrations, suppressed or opted-out recipients", () => {
    addEvent(db, { id: "e1", status: "cancelled" });
    db.profiles[1].notif_prefs.announcements = false;
    db.email_suppressions.push({ email: "a@example.com", reason: "bounce", at: at(-9) });
    db.notifications.push(
      row({ id: "cancelledEvent", template: "reminder_24h", priority: 1, payload: { event_id: "e1" }, profile_id: "b" }),
      row({ id: "suppressed", profile_id: "a" }),
      row({ id: "optedOut", profile_id: "b" }),
    );
    expect(dispatchOutbox(db, NOW)).toMatchObject({ sent: 0, skipped: 3 });
    expect(["cancelledEvent", "suppressed", "optedOut"].map(status)).toEqual(["skipped", "skipped", "skipped"]);
  });
  it("retries a failed send with growing delays and gives up after five attempts", () => {
    db.notifications.push(row({ id: "n1" }));
    const fail = () => "fail" as const;
    dispatchOutbox(db, NOW, { send: fail });
    expect(db.notifications[0]).toMatchObject({ status: "queued", attempts: 1 });
    expect(new Date(db.notifications[0].scheduled_at).getTime()).toBeGreaterThan(NOW.getTime());
    for (let i = 0; i < 4; i++) { db.notifications[0].scheduled_at = at(-1); dispatchOutbox(db, NOW, { send: fail }); }
    expect(db.notifications[0]).toMatchObject({ status: "failed", attempts: 5 });
  });
  it("simulates a bounce for addresses that contain 'bounce' so the failure UI can be exercised", () => {
    addProfile(db, { id: "bad", email: "bounce.me@example.com" });
    db.notifications.push(row({ id: "n1", profile_id: "bad" }));
    dispatchOutbox(db, NOW);
    expect(db.notifications[0]).toMatchObject({ status: "queued", attempts: 1, last_error: "mailbox_unavailable" });
  });
});

import { retryNotification } from "@/lib/mockdb/outbox";
import { addStaff } from "./helpers/fixture";

describe("retryNotification", () => {
  it("lets staff put a failed message back in the queue with a fresh attempt count", () => {
    addStaff(db, "org", "organizer");
    db.notifications.push(row({ id: "f1", status: "failed", attempts: 5, last_error: "mailbox_unavailable" }), row({ id: "s1", status: "sent" }));
    expect(retryNotification(ctx(db, "a"), { id: "f1" })).toEqual({ ok: false, error: "forbidden" });
    expect(retryNotification(ctx(db, "org"), { id: "f1" }).ok).toBe(true);
    expect(db.notifications.find((n) => n.id === "f1")).toMatchObject({ status: "queued", attempts: 0, last_error: null });
    expect(retryNotification(ctx(db, "org"), { id: "s1" })).toEqual({ ok: false, error: "conflict" });
    expect(retryNotification(ctx(db, "org"), { id: "zzz" })).toEqual({ ok: false, error: "not_found" });
    expect(db.audit_log.at(-1)).toMatchObject({ action: "notification.retry" });
  });
});
