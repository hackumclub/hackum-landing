// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { renewMembership } from "@/lib/mockdb/ext-membership";
import { reviewMembership } from "@/lib/mockdb/members";
import { addProfile, addStaff, at, ctx, emptyDb } from "./helpers/fixture";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "mem", status: "member" });
  addProfile(db, { id: "guest", status: "guest" });
  addProfile(db, { id: "must", status: "member", school_id: "must" });
  db.seasons.push({ year: 2027, label: { mn: "2027", en: "2027" }, application_opens_at: at(-24), application_closes_at: at(24 * 30), is_current: false });
  db.memberships.push({ profile_id: "mem", season: 2026, team: "Dev", role_title: null });
});

describe("renewMembership", () => {
  it("queues a pending application for the open season; approving it adds the season", () => {
    const r = renewMembership(ctx(db, "mem"));
    expect(r.ok).toBe(true);
    expect(db.membership_applications[0]).toMatchObject({ profile_id: "mem", season: 2027, status: "pending" });
    const id = db.membership_applications[0].id;
    expect(reviewMembership(ctx(db, "org"), { id, approve: true, note: "" }).ok).toBe(true);
    expect(db.memberships.some((m) => m.profile_id === "mem" && m.season === 2027)).toBe(true);
  });
  it("refuses non-members, a second renewal, a season already held, a closed window and non-NUM members", () => {
    expect(renewMembership(ctx(db, "guest"))).toEqual({ ok: false, error: "conflict" });
    expect(renewMembership(ctx(db, "must"))).toEqual({ ok: false, error: "ineligible" });
    expect(renewMembership(ctx(db, null))).toEqual({ ok: false, error: "unauthenticated" });
    expect(renewMembership(ctx(db, "mem")).ok).toBe(true);
    expect(renewMembership(ctx(db, "mem"))).toEqual({ ok: false, error: "conflict" });
    db.membership_applications.length = 0;
    db.memberships.push({ profile_id: "mem", season: 2027, team: null, role_title: null });
    expect(renewMembership(ctx(db, "mem"))).toEqual({ ok: false, error: "conflict" });
    db.memberships.pop();
    db.seasons[0].application_closes_at = at(-1);
    expect(renewMembership(ctx(db, "mem"))).toEqual({ ok: false, error: "closed" });
  });
});
