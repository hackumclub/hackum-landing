// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { feedbackAccess, feedbackCardState, feedbackDue } from "@/lib/me/feedback-due";
import { addEvent, addProfile, at, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
let n = 0;
const reg = (profile: string, event: string, status: Db["registrations"][number]["status"]) =>
  db.registrations.push({
    id: `r${++n}`, event_id: event, profile_id: profile, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null,
    decision_notified_at: null, created_at: at(-400), cancelled_at: null,
  });
const done = (id: string, endsHoursAgo: number, over: Partial<Db["events"][number]> = {}) =>
  addEvent(db, { id, status: "completed", starts_at: at(-endsHoursAgo - 2), ends_at: at(-endsHoursAgo), ...over });
const answer = (event: string, profile = "p") =>
  db.event_feedback.push({ id: `fb${++n}`, event_id: event, profile_id: profile, rating: 4, nps: 8, went_well: "", improve: "", anonymous: true, created_at: at(-1), updated_at: at(-1) });

beforeEach(() => {
  db = emptyDb();
  n = 0;
  addProfile(db, { id: "p" });
});

describe("feedbackDue", () => {
  it("lists completed events the person attended or was going to, inside the 14-day window, and has not answered", () => {
    done("a", 24); reg("p", "a", "attended");
    done("b", 48); reg("p", "b", "going");
    expect(feedbackDue(db, "p", NOW).map((d) => d.id).sort()).toEqual(["a", "b"]);
  });

  it("puts the survey that closes first at the top and reports when it closes", () => {
    done("late", 24); reg("p", "late", "attended");
    done("soon", 24 * 12); reg("p", "soon", "attended");
    const due = feedbackDue(db, "p", NOW);
    expect(due.map((d) => d.id)).toEqual(["soon", "late"]);
    expect(due[0].closesAt).toBe(at(-24 * 12 + 24 * 14));
  });

  it("skips answered events, no-shows, cancelled seats, other people's events and events that are not completed", () => {
    done("answered", 24); reg("p", "answered", "attended"); answer("answered");
    done("noshow", 24); reg("p", "noshow", "no_show");
    done("cancelled", 24); reg("p", "cancelled", "cancelled");
    done("stranger", 24);
    addEvent(db, { id: "live", status: "published", starts_at: at(-2), ends_at: at(2) }); reg("p", "live", "going");
    addEvent(db, { id: "cancelledEvent", status: "cancelled", starts_at: at(-30), ends_at: at(-28) }); reg("p", "cancelledEvent", "going");
    expect(feedbackDue(db, "p", NOW)).toEqual([]);
  });

  it("drops an event once its 14 days are over, but not a minute before", () => {
    done("edge", 24 * 14 - 1); reg("p", "edge", "attended");
    expect(feedbackDue(db, "p", NOW).map((d) => d.id)).toEqual(["edge"]);
    done("over", 24 * 14 + 1); reg("p", "over", "attended");
    expect(feedbackDue(db, "p", NOW).map((d) => d.id)).toEqual(["edge"]);
  });

  it("is empty for an unknown or deleted person and never leaks other people's answers", () => {
    done("a", 24); reg("p", "a", "attended");
    addProfile(db, { id: "q" }); reg("q", "a", "attended"); answer("a", "q");
    expect(feedbackDue(db, "ghost", NOW)).toEqual([]);
    expect(feedbackDue(db, "p", NOW).map((d) => d.id)).toEqual(["a"]); // q's answer does not count for p
  });
});

describe("feedbackAccess and the Past tab state", () => {
  it("open, answered-open, answered-closed, closed and none", () => {
    done("open", 24); reg("p", "open", "attended");
    expect(feedbackCardState(db, "open", "p", NOW)).toBe("give");
    answer("open");
    expect(feedbackCardState(db, "open", "p", NOW)).toBe("edit");

    done("shut", 24 * 20); reg("p", "shut", "attended"); answer("shut");
    expect(feedbackCardState(db, "shut", "p", NOW)).toBe("thanks");
    expect(feedbackAccess(db, db.events.find((e) => e.id === "shut")!, "p", NOW)).toMatchObject({ state: "closed", answer: { event_id: "shut" } });

    done("missed", 24 * 20); reg("p", "missed", "attended");
    expect(feedbackCardState(db, "missed", "p", NOW)).toBeNull();
    expect(feedbackAccess(db, db.events.find((e) => e.id === "missed")!, "p", NOW).state).toBe("closed");

    done("nope", 24);
    expect(feedbackCardState(db, "nope", "p", NOW)).toBeNull();
    expect(feedbackAccess(db, db.events.find((e) => e.id === "nope")!, "p", NOW).state).toBe("none");
    expect(feedbackCardState(db, "no-such-event", "p", NOW)).toBeNull();
  });
});
