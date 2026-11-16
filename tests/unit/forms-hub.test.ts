// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Question } from "@/lib/events/questions";
import type { FormSummary } from "@/lib/mockdb/forms";
import { answerText, csvHref, filterForms, formHref, isSiteForm, parseFormId, tabCounts } from "@/lib/forms/hub";

const row = (id: FormSummary["id"], kind: FormSummary["kind"], title: string): FormSummary => ({ id, kind, title: { mn: title, en: title }, event_id: null, question_count: 1, responses: 0, last_response_at: null });
const rows = [row("membership_application", "membership_application", "Membership"), row("join", "join", "Join Hackum"), row("event:e1", "event_registration", "DevHack"), row("event:e2", "event_registration", "Alumni night")];

describe("parseFormId", () => {
  it.each(["membership_application", "join", "event:e_12", "event%3Ae_12"])("accepts %s", (raw) => expect(parseFormId(raw)).not.toBeNull());
  it("decodes the colon", () => expect(parseFormId("event%3Ae_12")).toBe("event:e_12"));
  it.each(["", "nope", "event:", "event:a/b", "event:../x", "%E0%A4%A", "join%00", "event:" + "a".repeat(65)])("rejects %s", (raw) => expect(parseFormId(raw)).toBeNull());
});

describe("urls and kinds", () => {
  it("encodes the colon in links", () => {
    expect(formHref("event:e1", "responses")).toBe("/admin/forms/event%3Ae1?tab=responses");
    expect(formHref("join")).toBe("/admin/forms/join");
    expect(csvHref("event:e1", "en")).toBe("/api/admin/forms/event%3Ae1/csv?lang=en");
  });
  it("only the two site forms are editable here", () => {
    expect(isSiteForm("join")).toBe(true);
    expect(isSiteForm("event:e1")).toBe(false);
  });
});

describe("filterForms and tabCounts", () => {
  it("filters by kind and search (either language, case-insensitive)", () => {
    expect(filterForms(rows, { tab: "event_registration", q: "" }).map((r) => r.id)).toEqual(["event:e1", "event:e2"]);
    expect(filterForms(rows, { tab: "all", q: "  DEVhack " }).map((r) => r.id)).toEqual(["event:e1"]);
    expect(filterForms(rows, { tab: "join", q: "devhack" })).toEqual([]);
  });
  it("counts follow the search but not the tab", () => {
    expect(tabCounts(rows, "")).toEqual({ all: 4, event_registration: 2, membership_application: 1, join: 1 });
    expect(tabCounts(rows, "night")).toEqual({ all: 1, event_registration: 1, membership_application: 0, join: 0 });
  });
});

describe("answerText", () => {
  const sel: Question = { id: "s", type: "select", required: false, label: { mn: "С", en: "S" }, options: [{ mn: "Нэг", en: "One" }, { mn: "Хоёр", en: "" }] };
  it("maps option indexes to the option text in the viewer's language, falling back to Mongolian", () => {
    expect(answerText(sel, "0", "en", "Yes", "No")).toBe("One");
    expect(answerText(sel, "1", "en", "Yes", "No")).toBe("Хоёр");
    expect(answerText({ ...sel, type: "multi" }, ["0", "1"], "mn", "Тийм", "Үгүй")).toBe("Нэг; Хоёр");
  });
  it("checkbox, missing and out-of-range answers", () => {
    expect(answerText({ ...sel, type: "checkbox" }, true, "en", "Yes", "No")).toBe("Yes");
    expect(answerText({ ...sel, type: "checkbox" }, false, "en", "Yes", "No")).toBe("No");
    expect(answerText(sel, undefined, "en", "Yes", "No")).toBe("");
    expect(answerText(sel, "9", "en", "Yes", "No")).toBe("9");
  });
});
