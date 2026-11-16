// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ALL_TEMPLATES, renderEmail } from "@/emails/render";
import { SITE_URL } from "@/lib/site-url";
import type { Locale } from "@/i18n/config";
import type { Notification, TemplateName } from "@/lib/mockdb/types";

type Payload = Notification["payload"];
const LANGS: Locale[] = ["mn", "en"];
const SENTINEL = "<x-pay>";

const full: Payload = {
  to_name: "Болд",
  event_id: "ev-123",
  event_slug: "hackum-2026",
  event_title_mn: "Хакатон 2026",
  event_title_en: "Hackathon 2026",
  starts_at: "2026-12-01T10:00:00Z",
  ends_at: "2026-12-01T12:00:00Z",
  venue: "МУИС, 2-р байр",
  mode: "offline",
  ics_sequence: 2,
  team_name: "Манул баг",
  invite_code: "ABC123",
  season: 2026,
  subject_mn: "Шинэ мэдээ",
  subject_en: "News",
  body_mn: "Эхний догол.\n\nХоёр дахь догол.",
  body_en: "First paragraph.\n\nSecond paragraph.",
};
const hostile = Object.fromEntries(Object.entries(full).map(([k, v]) => [k, typeof v === "string" && k !== "starts_at" && k !== "ends_at" && k !== "mode" ? `${v}${SENTINEL}` : v])) as Payload;

describe("ALL_TEMPLATES", () => {
  it("lists the 13 templates once each", () => {
    expect(new Set(ALL_TEMPLATES).size).toBe(13);
    expect(ALL_TEMPLATES).toContain("reminder_24h");
  });
});

describe.each(LANGS)("renderEmail %s", (lang) => {
  it.each(ALL_TEMPLATES)("%s renders subject, html and text", (t) => {
    const r = renderEmail(t, full, lang);
    expect(r.subject.trim().length).toBeGreaterThan(0);
    expect(r.subject).not.toMatch(/[\r\n]/);
    expect(r.text.trim().length).toBeGreaterThan(20);
    expect(r.html).toContain("<!doctype html>");
    expect(r.html).toContain(`lang="${lang}"`);
    expect(r.html).toContain("#0085ca");
    expect(r.html).toContain(`${SITE_URL}/img/brand/logo-128.png`);
    expect(r.html).toContain(`href="${SITE_URL}/${lang}/me/settings"`);
    expect(r.text).toContain(`${SITE_URL}/${lang}/me/settings`);
    expect(r.html + r.text).not.toMatch(/undefined|\bnull\b|NaN|\[object/);
  });

  it.each(ALL_TEMPLATES)("%s html never contains unescaped payload strings", (t) => {
    const r = renderEmail(t, hostile, lang);
    expect(r.html).not.toContain(SENTINEL);
    expect(r.html).not.toMatch(/<x-pay/);
  });

  it.each(ALL_TEMPLATES)("%s renders gracefully with an empty payload", (t) => {
    const r = renderEmail(t, {}, lang);
    expect(r.subject.trim().length).toBeGreaterThan(0);
    expect(r.html.length).toBeGreaterThan(200);
    expect(r.text.trim().length).toBeGreaterThan(10);
    expect(r.html + r.text + r.subject).not.toMatch(/undefined|\bnull\b|NaN|\[object|Invalid Date/);
    expect(r.ics).toBeUndefined(); // no event data, nothing to put in a calendar
  });
});

describe("ICS presence", () => {
  const withIcs: TemplateName[] = ["rsvp_confirmed", "application_accepted", "waitlist_promoted", "event_updated", "event_cancelled"];
  it.each(withIcs)("%s returns an IcsEvent", (t) => {
    const r = renderEmail(t, full, "en");
    expect(r.ics).toBeDefined();
    expect(r.ics?.uid).toBe("ev-123@hackum");
    expect(r.ics?.sequence).toBe(2);
    expect(r.ics?.start.toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(r.ics?.end.toISOString()).toBe("2026-12-01T12:00:00.000Z");
    expect(r.ics?.method).toBe(t === "event_cancelled" ? "CANCEL" : "REQUEST");
    expect(r.ics?.title).toBe("Hackathon 2026");
    expect(r.ics?.location).toContain("МУИС");
  });
  it.each(ALL_TEMPLATES.filter((t) => !withIcs.includes(t)))("%s returns no IcsEvent", (t) => {
    expect(renderEmail(t, full, "mn").ics).toBeUndefined();
  });
  it("rsvp_confirmed links to Google Calendar with UTC dates", () => {
    const r = renderEmail("rsvp_confirmed", full, "en");
    expect(r.html).toContain("calendar.google.com/calendar/render");
    expect(r.html).toContain("dates=20261201T100000Z/20261201T120000Z");
    expect(r.text).toContain("dates=20261201T100000Z/20261201T120000Z");
    expect(r.html).toContain("Add to calendar");
    expect(renderEmail("rsvp_confirmed", full, "mn").html).toContain("Календарьт нэмэх");
  });
});

describe("content rules", () => {
  it("keeps a Cyrillic subject intact", () => {
    const r = renderEmail("rsvp_confirmed", full, "mn");
    expect(r.subject).toContain("Хакатон 2026");
    expect(r.subject).not.toContain("�");
    expect(r.ics?.title).toBe("Хакатон 2026");
  });
  it("falls back to the Mongolian title when the English one is empty", () => {
    const r = renderEmail("rsvp_confirmed", { ...full, event_title_en: "  " }, "en");
    expect(r.subject).toContain("Хакатон 2026");
    expect(r.ics?.title).toBe("Хакатон 2026");
  });
  it("shows Ulaanbaatar time with a UTC+8 mention", () => {
    const en = renderEmail("reminder_24h", full, "en");
    expect(en.text).toContain("UTC+8");
    expect(en.text).toContain("6:00");
    expect(en.text).toContain("8:00");
    const mn = renderEmail("reminder_24h", full, "mn");
    expect(mn.text).toContain("UTC+8");
    expect(mn.text).toContain("18:00");
  });
  it("escapes HTML in user strings but not the plain-text part", () => {
    const r = renderEmail("rsvp_confirmed", { ...full, to_name: "<script>alert(1)</script>" }, "en");
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(r.text).toContain("<script>alert(1)</script>");
  });
  it("strips line breaks from the subject (header injection)", () => {
    const r = renderEmail("rsvp_confirmed", { ...full, event_title_mn: "A\r\nBcc: x@y.z" }, "mn");
    expect(r.subject).not.toMatch(/[\r\n]/);
  });
  it("event_updated names what changed only when provided", () => {
    const specific = renderEmail("event_updated", { ...full, changed: "time, venue" }, "en");
    expect(specific.text).toContain("time, venue");
    const generic = renderEmail("event_updated", full, "en");
    expect(generic.text).not.toContain("time, venue");
    expect(generic.text.length).toBeGreaterThan(20);
  });
  it("rejection emails never leak staff notes", () => {
    for (const lang of LANGS) {
      for (const t of ["application_rejected", "membership_rejected"] as const) {
        const r = renderEmail(t, { ...full, review_note: "SECRET-NOTE", staff_note: "SECRET-NOTE", note: "SECRET-NOTE" }, lang);
        expect(r.html + r.text + r.subject).not.toContain("SECRET-NOTE");
      }
    }
  });
  it("announcement uses its own subject/body with mn fallback, split into paragraphs", () => {
    const en = renderEmail("announcement", full, "en");
    expect(en.subject).toBe("News");
    expect(en.html.match(/<p /g)?.length).toBeGreaterThanOrEqual(2);
    const fb = renderEmail("announcement", { ...full, subject_en: "", body_en: "" }, "en");
    expect(fb.subject).toBe("Шинэ мэдээ");
    expect(fb.text).toContain("Эхний догол.");
  });
  it("names the team in accepted applications and shows the invite code on receipt", () => {
    expect(renderEmail("application_accepted", full, "en").text).toContain("Манул баг");
    expect(renderEmail("application_received", full, "en").text).toContain("ABC123");
  });
  it("membership emails mention the season", () => {
    expect(renderEmail("membership_approved", full, "en").text).toContain("2026");
  });
});
