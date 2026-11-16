// @vitest-environment node
import { describe, expect, it } from "vitest";
import { describeInbox } from "@/lib/notifications/map";
import type { InboxItem, InboxKind } from "@/lib/mockdb/types";
import { copy } from "@/i18n/areas/shell";

const item = (kind: InboxKind, payload: InboxItem["payload"] = {}): InboxItem => ({ id: "in_1", profile_id: "p", kind, payload, created_at: "2026-11-16T04:00:00Z", read_at: null, dedupe_key: "k" });
const ev = { event_slug: "knowledge-day-rag", event_title_en: "Knowledge Day: RAG", event_title_mn: "Мэдлэгийн өдөр: RAG" };

describe("describeInbox (kind + payload to title, one line and the object link)", () => {
  it("sends event-side kinds to the public event page, with the event name in the line", () => {
    for (const kind of ["rsvp_confirmed", "waitlist_notice", "waitlist_promoted", "event_updated", "event_cancelled", "reminder_24h"] as const) {
      const v = describeInbox(item(kind, ev), "en");
      expect(v.href, kind).toBe("/en/events/knowledge-day-rag");
      expect(v.line, kind).toContain("Knowledge Day: RAG");
      expect(v.title, kind).not.toBe("");
    }
  });
  it("uses the Mongolian title in Mongolian and falls back to the other language, then the slug", () => {
    expect(describeInbox(item("rsvp_confirmed", ev), "mn").line).toContain("Мэдлэгийн өдөр: RAG");
    expect(describeInbox(item("rsvp_confirmed", { event_slug: "x", event_title_en: "Only English" }), "mn").line).toContain("Only English");
    expect(describeInbox(item("rsvp_confirmed", { event_slug: "my-slug" }), "en").line).toContain("my-slug");
  });
  it("sends application_* to the apply status page and membership_* to membership", () => {
    for (const kind of ["application_received", "application_accepted", "application_rejected"] as const) {
      expect(describeInbox(item(kind, ev), "en").href).toBe("/en/me/events/knowledge-day-rag/apply");
    }
    for (const kind of ["membership_approved", "membership_rejected"] as const) expect(describeInbox(item(kind, { season: 2027 }), "mn").href).toBe("/mn/me/membership");
  });
  it("routes staff items to the working queue", () => {
    expect(describeInbox(item("staff_application", { name: "Бат" }), "en")).toMatchObject({ href: "/en/admin/members?tab=applications", line: "Бат sent an application." });
    expect(describeInbox(item("staff_failed_email", { template: "rsvp_confirmed" }), "en").href).toBe("/en/admin/comms?status=failed");
  });
  it("announcement shows its own title when it has one, links to the event when it names one, else nowhere", () => {
    expect(describeInbox(item("announcement", { title: "Venue moved" }), "en")).toMatchObject({ title: "Venue moved", href: null });
    expect(describeInbox(item("announcement", { ...ev, title: "Venue moved" }), "en").href).toBe("/en/events/knowledge-day-rag");
    expect(describeInbox(item("announcement", { campaign: "x" }), "en").title).toBe(copy.en.kinds.announcement.title);
  });
  it("never throws on missing payload data and never links with an unsafe slug", () => {
    expect(describeInbox(item("rsvp_confirmed"), "en").href).toBe("/en/me/events");
    expect(describeInbox(item("rsvp_confirmed", { event_slug: "../admin" }), "en").href).toBe("/en/me/events");
    expect(describeInbox(item("staff_application"), "en").line).toContain(copy.en.generic.person);
    expect(describeInbox(item("welcome"), "en").href).toBe("/en/me");
  });
  it("covers every inbox kind in both languages with a non-empty title and line", () => {
    for (const lang of ["mn", "en"] as const) for (const kind of Object.keys(copy.en.kinds) as InboxKind[]) {
      const v = describeInbox(item(kind, ev), lang);
      expect(v.title.length, `${lang} ${kind}`).toBeGreaterThan(0);
      expect(v.line.length, `${lang} ${kind}`).toBeGreaterThan(0);
    }
  });
});
