// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminPreviewAllowed, adminNav } from "@/lib/admin/nav";

afterEach(() => vi.unstubAllEnvs());

describe("adminPreviewAllowed (temporary gate until Clerk staff auth, plan Task 5)", () => {
  it("blocks admin pages in production unless ADMIN_PREVIEW=1", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PREVIEW", "");
    expect(adminPreviewAllowed()).toBe(false);
    vi.stubEnv("ADMIN_PREVIEW", "1");
    expect(adminPreviewAllowed()).toBe(true);
  });
  it("allows admin pages in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(adminPreviewAllowed()).toBe(true);
  });
});

describe("adminNav", () => {
  it("builds locale-prefixed hrefs and has no unfinished sections left", () => {
    const nav = adminNav("en", "admin");
    expect(nav.find((i) => i.key === "dashboard")).toMatchObject({ href: "/en/admin", ready: true });
    expect(nav.find((i) => i.key === "inbox")).toMatchObject({ href: "/en/admin/inbox", ready: true });
    expect(nav.every((i) => i.ready)).toBe(true);
  });
  it("organizer gets the working areas and no Settings or Audit (F-04, F-18)", () => {
    expect(adminNav("en", "organizer").map((i) => i.key)).toEqual(["dashboard", "events", "members", "forms", "polls", "analytics", "reports", "comms", "inbox"]);
  });
  it("admin gets everything, Settings and Audit last; the developer kit is never listed", () => {
    const keys = adminNav("mn", "admin").map((i) => i.key);
    expect(keys).toEqual(["dashboard", "events", "members", "forms", "polls", "analytics", "reports", "comms", "inbox", "settings", "audit"]);
    expect(keys).not.toContain("kit");
  });
  it("keeps the old one-argument call working (admin view)", () => {
    expect(adminNav("en").map((i) => i.key)).toContain("settings");
  });
});
