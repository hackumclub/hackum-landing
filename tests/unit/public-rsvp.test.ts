// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { rsvpView, type Viewer } from "@/lib/public/rsvp";
import { addEvent, addProfile, at, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
beforeEach(() => { db = emptyDb(); for (const id of ["me", "o1", "o2", "o3"]) addProfile(db, { id }); });
const reg = (eventId: string, profileId: string, status: Db["registrations"][number]["status"], createdAt = at(-10)) =>
  db.registrations.push({ id: `r_${eventId}_${profileId}`, event_id: eventId, profile_id: profileId, status, source: "web", answers: {}, team_id: null, decided_by: null, decided_at: null, decision_notified_at: null, created_at: createdAt, cancelled_at: null });
const guest: Viewer = { profileId: "me", status: "guest", onboarded: true };
const member: Viewer = { profileId: "me", status: "member", onboarded: true };
const view = (id: string, viewer: Viewer) => rsvpView(db, db.events.find((e) => e.id === id)!, viewer, NOW);

describe("rsvpView", () => {
  it("signed out → sign-in call to action (apply flavour for application events)", () => {
    addEvent(db, { id: "r" }); addEvent(db, { id: "a", reg_mode: "application" });
    expect(view("r", null)).toEqual({ kind: "signed_out", apply: false });
    expect(view("a", null)).toEqual({ kind: "signed_out", apply: true });
  });

  it("signed in but not onboarded → finish the profile first", () => {
    addEvent(db, { id: "r" });
    expect(view("r", { ...guest, onboarded: false })).toEqual({ kind: "needs_onboarding" });
  });

  it("open RSVP event → RSVP; full with waitlist → waitlist flavour; full without → blocked", () => {
    addEvent(db, { id: "r", capacity: 1 });
    expect(view("r", guest)).toEqual({ kind: "rsvp", waitlist: false });
    reg("r", "o1", "going");
    expect(view("r", guest)).toEqual({ kind: "rsvp", waitlist: true });
    db.events[0].waitlist = false;
    expect(view("r", guest)).toEqual({ kind: "blocked", reason: "full" });
    expect(view("r", null)).toEqual({ kind: "blocked", reason: "full" });
  });

  it("own registration states: going, waitlisted with position, applied, rejected, attended", () => {
    addEvent(db, { id: "w", capacity: 1 }); reg("w", "o1", "going"); reg("w", "o2", "waitlisted", at(-20)); reg("w", "me", "waitlisted", at(-10));
    expect(view("w", guest)).toEqual({ kind: "waitlisted", position: 2 });
    addEvent(db, { id: "g" }); reg("g", "me", "going");
    expect(view("g", guest)).toEqual({ kind: "going" });
    addEvent(db, { id: "a", reg_mode: "application" }); reg("a", "me", "applied");
    expect(view("a", guest)).toEqual({ kind: "applied" });
    addEvent(db, { id: "x", reg_mode: "application" }); reg("x", "me", "rejected");
    expect(view("x", guest)).toEqual({ kind: "rejected" });
    addEvent(db, { id: "t", status: "completed", starts_at: at(-10), ends_at: at(-8) }); reg("t", "me", "attended");
    expect(view("t", guest)).toEqual({ kind: "attended" });
  });

  it("a cancelled registration counts as no registration", () => {
    addEvent(db, { id: "r" }); reg("r", "me", "cancelled");
    expect(view("r", guest)).toEqual({ kind: "rsvp", waitlist: false });
  });

  it("your own seat stays visible (and cancellable) even if registration has since closed or the audience changed", () => {
    addEvent(db, { id: "r", reg_closes_at: at(-1), audience: "members" }); reg("r", "me", "going");
    expect(view("r", guest)).toEqual({ kind: "going" });
  });

  it("application events offer Apply with the decision deadline and never an RSVP", () => {
    addEvent(db, { id: "a", reg_mode: "application", decision_deadline: at(100), capacity: 1 }); reg("a", "o1", "going");
    expect(view("a", guest)).toEqual({ kind: "apply", decisionDeadline: at(100) });
  });

  it("restrictions give a specific reason: invite, members, alumni, not open, closed", () => {
    addEvent(db, { id: "i", audience: "invite" }); addEvent(db, { id: "m", audience: "members" }); addEvent(db, { id: "al", audience: "alumni" });
    addEvent(db, { id: "n", reg_opens_at: at(5) }); addEvent(db, { id: "c", reg_closes_at: at(-5) });
    expect(view("i", member)).toEqual({ kind: "blocked", reason: "invite" });
    expect(view("m", guest)).toEqual({ kind: "blocked", reason: "members" });
    expect(view("m", member)).toEqual({ kind: "rsvp", waitlist: false });
    expect(view("al", member)).toEqual({ kind: "blocked", reason: "alumni" });
    expect(view("al", { ...guest, status: "alumni" })).toEqual({ kind: "rsvp", waitlist: false });
    expect(view("n", guest)).toEqual({ kind: "blocked", reason: "not_open", opensAt: at(5) });
    expect(view("c", guest)).toEqual({ kind: "blocked", reason: "closed" });
  });

  it("members-only events still invite signed-out people to sign in (they may be members)", () => {
    addEvent(db, { id: "m", audience: "members" });
    expect(view("m", null)).toEqual({ kind: "signed_out", apply: false });
  });

  it("ended and cancelled events offer nothing to do", () => {
    addEvent(db, { id: "e", starts_at: at(-10), ends_at: at(-8) }); addEvent(db, { id: "c", status: "cancelled" }); addEvent(db, { id: "d", status: "archived" });
    expect(view("e", guest)).toEqual({ kind: "ended" });
    expect(view("c", guest)).toEqual({ kind: "cancelled" });
    expect(view("d", null)).toEqual({ kind: "ended" });
  });

  it("agrees with the rule: whatever it offers, registerForEvent accepts", async () => {
    const { registerForEvent } = await import("@/lib/mockdb/registrations");
    addEvent(db, { id: "r", capacity: 1 }); reg("r", "o1", "going");
    expect(view("r", guest)).toEqual({ kind: "rsvp", waitlist: true });
    expect(registerForEvent({ db, actor: "me", now: NOW }, { eventId: "r", answers: {} })).toEqual({ ok: true, data: { status: "waitlisted" } });
  });

  it("school scope: a NUM-only event is blocked for a student of another school (or one with no school yet), open to NUM students and to unknown viewers", () => {
    addEvent(db, { id: "n", school_scope: "num" });
    expect(view("n", { ...guest, schoolId: "must" })).toEqual({ kind: "blocked", reason: "school" });
    expect(view("n", { ...guest, schoolId: null })).toEqual({ kind: "blocked", reason: "school" });
    expect(view("n", { ...guest, schoolId: "num" })).toEqual({ kind: "rsvp", waitlist: false });
    expect(view("n", guest)).toEqual({ kind: "rsvp", waitlist: false });
    expect(view("n", null)).toEqual({ kind: "signed_out", apply: false });
  });

  it("members-only event: another school's guest is told membership is NUM-only; a NUM guest is not", () => {
    addEvent(db, { id: "m2", audience: "members" });
    expect(view("m2", { ...guest, schoolId: "must" })).toEqual({ kind: "blocked", reason: "members", numOnly: true });
    expect(view("m2", { ...guest, schoolId: "num" })).toEqual({ kind: "blocked", reason: "members" });
  });
});
