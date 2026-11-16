// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import type { RegStatus } from "@/lib/status";
import { buildAttention } from "@/lib/admin/attention-links";
import { addEvent, addProfile, emptyDb } from "./helpers/fixture";

let db: Db;
const reg = (event_id: string, profile_id: string, status: RegStatus) =>
  db.registrations.push({ id: `r${db.registrations.length}`, event_id, profile_id, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: "2026-11-01T00:00:00Z", cancelled_at: null });
const find = (kind: string) => buildAttention(db, "en").find((a) => a.kind === kind);

beforeEach(() => {
  db = emptyDb();
  for (const id of ["a", "b", "c", "d"]) addProfile(db, { id });
  addEvent(db, { id: "e1", cover_path: "c.jpg", reg_mode: "application", title: { mn: "Нэг", en: "One" } });
  addEvent(db, { id: "e2", cover_path: "c.jpg", reg_mode: "application", title: { mn: "Хоёр", en: "Two" } });
});

describe("needs-attention links go to the object (F-17)", () => {
  it("with one event waiting, applications link straight to that event's registrations filtered to applied", () => {
    reg("e1", "a", "applied"); reg("e1", "b", "applied");
    expect(find("pending_applications")).toMatchObject({ count: 2, href: "/en/admin/events/e1/registrations?status=applied", more: 0, eventTitle: { mn: "Нэг", en: "One" } });
  });
  it("with several events, picks the one with the most pending and counts the others", () => {
    reg("e1", "a", "applied"); reg("e2", "a", "applied"); reg("e2", "b", "applied"); reg("e2", "c", "applied");
    const a = find("pending_applications")!;
    expect(a).toMatchObject({ count: 4, href: "/en/admin/events/e2/registrations?status=applied", more: 1, moreHref: "/en/admin/events?filter=applications" });
  });
  it("ties go to the earliest event, and draft or cancelled events are ignored like the count", () => {
    addEvent(db, { id: "e3", cover_path: "c.jpg", reg_mode: "application", status: "draft" });
    reg("e3", "a", "applied"); reg("e3", "b", "applied"); reg("e3", "c", "applied");
    reg("e1", "a", "applied"); reg("e2", "a", "applied");
    expect(find("pending_applications")).toMatchObject({ count: 2, href: "/en/admin/events/e1/registrations?status=applied", more: 1 });
  });
  it("failed emails and membership applications link to their lists", () => {
    db.notifications.push({ status: "failed" } as Db["notifications"][number]);
    db.membership_applications.push({ status: "pending" } as Db["membership_applications"][number]);
    expect(find("failed_emails")?.href).toBe("/en/admin/comms?status=failed");
    expect(find("pending_members")?.href).toBe("/en/admin/members?tab=applications");
  });
  it("uses the locale in every link and is empty when nothing waits", () => {
    expect(buildAttention(db, "mn")).toEqual([]);
    db.notifications.push({ status: "failed" } as Db["notifications"][number]);
    expect(buildAttention(db, "mn")[0].href).toBe("/mn/admin/comms?status=failed");
  });
});
