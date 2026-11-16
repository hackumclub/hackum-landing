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
    const nav = adminNav("en");
    expect(nav.find((i) => i.key === "dashboard")).toMatchObject({ href: "/en/admin", ready: true });
    expect(nav.find((i) => i.key === "events")).toMatchObject({ href: "/en/admin/events", ready: true });
    expect(nav.every((i) => i.ready)).toBe(true); // every backoffice area is built; no "Soon" items left
    expect(nav.map((i) => i.key)).toEqual(["dashboard", "events", "members", "comms", "settings", "audit", "kit"]);
  });
});
