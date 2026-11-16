// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isVisibleEventSlug } from "@/lib/public/slugs";
import { addEvent, emptyDb } from "./helpers/fixture";

describe("isVisibleEventSlug (the proxy's 404 check)", () => {
  it("knows every event a visitor may open: published, completed, archived and cancelled", () => {
    const db = emptyDb();
    for (const status of ["published", "completed", "archived", "cancelled"] as const) addEvent(db, { id: status, status });
    for (const status of ["published", "completed", "archived", "cancelled"]) expect(isVisibleEventSlug(db, `${status}-slug`)).toBe(true);
  });
  it("does not know drafts or slugs that never existed", () => {
    const db = emptyDb();
    addEvent(db, { id: "d", status: "draft" });
    expect(isVisibleEventSlug(db, "d-slug")).toBe(false);
    expect(isVisibleEventSlug(db, "nope")).toBe(false);
    expect(isVisibleEventSlug(db, "")).toBe(false);
  });
  it("matches the slug exactly (no case folding, no prefixes)", () => {
    const db = emptyDb();
    addEvent(db, { id: "x", slug: "knowledge-day-rag" });
    expect(isVisibleEventSlug(db, "Knowledge-Day-RAG")).toBe(false);
    expect(isVisibleEventSlug(db, "knowledge-day")).toBe(false);
    expect(isVisibleEventSlug(db, "knowledge-day-rag")).toBe(true);
  });
});
