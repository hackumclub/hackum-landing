// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/i18n/areas/admin-polls";
import { pollResultsToCsv } from "@/lib/polls/csv";
import { draftFromPoll, emptyDraft, moveOption, nextOptionId, toInput, validateDraft, type PollDraft } from "@/lib/polls/form";
import { pollMessage } from "@/lib/polls/errors";
import { audienceCounts, filterPolls, notifyCount, pollPhase, pollRows } from "@/lib/polls/rows";
import { emptyListState, type ListState } from "@/lib/admin/list-state";
import { createPoll, pollResults, setPollStatus, vote, type PollInput } from "@/lib/mockdb/polls";
import type { Ctx, Db } from "@/lib/mockdb/types";
import { err, type ErrorCode, type Result } from "@/lib/result";
import { addProfile, addStaff, at, ctx as mkCtx, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
let actor: string | null = null;
vi.mock("@/lib/server/session", () => ({
  requireStaffAction: async () => {
    if (!actor) return err("unauthenticated");
    return db.staff_roles.some((r) => r.profile_id === actor) ? { ok: true, data: { profileId: actor } } : err("forbidden");
  },
  act: async <T,>(rule: (c: Ctx) => Result<T>) => rule(mkCtx(db, actor)),
}));
vi.mock("@/lib/log", () => ({ log: () => undefined }));
const actions = await import("@/lib/polls/actions");

const input = (over: Partial<PollInput> = {}): PollInput => ({
  title: { mn: "Дараагийн сэдэв?", en: "Next topic?" }, description: { mn: "", en: "" },
  options: [{ id: "o1", label: { mn: "AI", en: "AI" } }, { id: "o2", label: { mn: "Вэб", en: "Web" } }],
  multi: false, max_choices: 1, audience: "members", anonymous: false, results: "after_vote", opens_at: null, closes_at: null, ...over,
});
const CODES: ErrorCode[] = ["unauthenticated", "forbidden", "not_found", "invalid", "conflict", "full", "closed", "rate_limited", "ineligible", "server"];

beforeEach(() => {
  db = emptyDb(); actor = null;
  addStaff(db, "org", "organizer"); addStaff(db, "boss", "admin");
  addProfile(db, { id: "mem", status: "member" });
  addProfile(db, { id: "m2", status: "member", name: { mn: "=HYPERLINK(\"x\")", en: "=HYPERLINK(\"x\")" } });
  addProfile(db, { id: "al", status: "alumni" });
  addProfile(db, { id: "gst", status: "guest" });
});

describe("poll actions: who may call them", () => {
  const calls = {
    create: () => actions.createPollAction(input()),
    update: () => actions.updatePollAction("poll_x", input()),
    status: () => actions.setPollStatusAction("poll_x", "published"),
  };
  it.each([[null, "unauthenticated"], ["mem", "forbidden"], ["al", "forbidden"], ["gst", "forbidden"]] as const)("%s gets %s on every action and nothing is written", async (who, code) => {
    actor = who;
    for (const [name, call] of Object.entries(calls)) expect(await call(), name).toEqual({ ok: false, error: code });
    expect(db.polls).toHaveLength(0);
  });
  it.each(["org", "boss"])("%s (staff) can create, edit, publish, close and reopen", async (who) => {
    actor = who;
    const made = await actions.createPollAction(input());
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect((await actions.updatePollAction(made.data.id, input({ title: { mn: "Шинэ", en: "New" } }))).ok).toBe(true);
    const pub = await actions.setPollStatusAction(made.data.id, "published");
    expect(pub).toEqual({ ok: true, data: { notified: 2 } }); // m1 and m2
    expect((await actions.setPollStatusAction(made.data.id, "closed")).ok).toBe(true);
    expect((await actions.setPollStatusAction(made.data.id, "published")).ok).toBe(true);
    expect(db.polls[0].status).toBe("published");
  });
  it("rejects malformed payloads before the rule runs", async () => {
    actor = "org";
    for (const bad of [null, "x", {}, { ...input(), audience: "all" }, { ...input(), multi: "yes" }, { ...input(), options: "no" }]) expect(await actions.createPollAction(bad), JSON.stringify(bad)).toEqual({ ok: false, error: "invalid" });
    expect(await actions.updatePollAction(42, input())).toEqual({ ok: false, error: "invalid" });
    expect(await actions.setPollStatusAction("p", "deleted")).toEqual({ ok: false, error: "invalid" });
    expect(await actions.setPollStatusAction({}, "closed")).toEqual({ ok: false, error: "invalid" });
    expect(db.polls).toHaveLength(0);
  });
  it("passes rule errors through: unknown poll, locked ballot, bad transition", async () => {
    actor = "org";
    expect(await actions.updatePollAction("nope", input())).toEqual({ ok: false, error: "not_found" });
    expect(await actions.createPollAction(input({ options: [{ id: "o1", label: { mn: "A", en: "" } }] }))).toEqual({ ok: false, error: "invalid" });
    const id = (await actions.createPollAction(input()) as { ok: true; data: { id: string } }).data.id;
    expect(await actions.setPollStatusAction(id, "closed")).toEqual({ ok: false, error: "conflict" });
    await actions.setPollStatusAction(id, "published");
    vote(mkCtx(db, "mem"), { pollId: id, optionIds: ["o1"] });
    expect(await actions.updatePollAction(id, input({ options: [...input().options, { id: "o3", label: { mn: "C", en: "" } }] }))).toEqual({ ok: false, error: "conflict" });
    expect((await actions.updatePollAction(id, input({ title: { mn: "Өөр", en: "" } }))).ok).toBe(true);
  });
});

describe("error messages", () => {
  it("every code, scope and language has a real sentence and never the code", () => {
    for (const lang of ["mn", "en"] as const) for (const scope of ["save", "status"] as const) for (const code of CODES) {
      const m = pollMessage(code, lang, scope);
      expect(m.trim().length, `${lang}/${scope}/${code}`).toBeGreaterThan(10);
      expect(m).not.toBe(code);
      expect(m).not.toMatch(/^[a-z_]+$/);
    }
    expect(pollMessage("conflict", "en", "save")).toBe(copy.en.errors.conflictSave);
    expect(pollMessage("conflict", "en", "status")).toBe(copy.en.errors.conflictStatus);
  });
});

describe("draft form", () => {
  const filled = (over: Partial<PollDraft> = {}): PollDraft => ({ ...emptyDraft(), title: { mn: "Гарчиг", en: "" }, options: [{ id: "o1", label: { mn: "A", en: "" } }, { id: "o2", label: { mn: "B", en: "" } }], ...over });
  it("starts with two empty options and flags exactly what is missing", () => {
    expect(Object.keys(validateDraft(emptyDraft())).sort()).toEqual(["option.0", "option.1", "title"]);
    expect(validateDraft(filled())).toEqual({});
  });
  it("mirrors the rule: option count, multi max, times", () => {
    expect(validateDraft(filled({ options: [{ id: "o1", label: { mn: "A", en: "" } }] })).options).toBe("options");
    expect(validateDraft(filled({ multi: true, maxChoices: 3 })).maxChoices).toBe("maxChoices");
    expect(validateDraft(filled({ multi: true, maxChoices: 2 })).maxChoices).toBeUndefined();
    expect(validateDraft(filled({ opensAt: at(5), closesAt: at(2) })).closes).toBe("closes");
    expect(validateDraft(filled({ closesAt: "nope" })).closes).toBe("date");
    expect(validateDraft(filled({ options: [{ id: "o1", label: { mn: "A", en: "x".repeat(121) } }, { id: "o2", label: { mn: "B", en: "" } }] }))["optionEn.0"]).toBe("optionEn");
  });
  it("whatever validateDraft accepts, the rule accepts", () => {
    actor = "org";
    const r = createPoll(mkCtx(db, "org"), toInput(filled({ multi: true, maxChoices: 2, closesAt: at(48) })));
    expect(r.ok).toBe(true);
  });
  it("single choice always saves max_choices 1; multi clamps to the option count; text is trimmed", () => {
    expect(toInput(filled({ multi: false, maxChoices: 5 })).max_choices).toBe(1);
    expect(toInput(filled({ multi: true, maxChoices: 9 })).max_choices).toBe(2);
    expect(toInput(filled({ title: { mn: "  A  ", en: " " } })).title).toEqual({ mn: "A", en: "" });
  });
  it("option ids are stable and never reused; reordering keeps ids", () => {
    expect(nextOptionId(["o1", "o2"])).toBe("o3");
    expect(nextOptionId(["o1", "o3"])).toBe("o2");
    expect(nextOptionId(["o1", "o2", "o3", "o2"])).toBe("o4");
    const d = filled();
    expect(moveOption(d.options, 0, 1).map((o) => o.id)).toEqual(["o2", "o1"]);
    expect(moveOption(d.options, 0, -1)).toBe(d.options);
  });
  it("round-trips a stored poll", () => {
    const made = createPoll(mkCtx(db, "org"), input({ closes_at: at(24) }));
    if (!made.ok) throw new Error();
    expect(toInput(draftFromPoll(db.polls[0]))).toEqual(input({ closes_at: at(24) }));
  });
});

describe("list rows", () => {
  it("phase, turnout and audience counts agree with the rules", () => {
    const a = createPoll(mkCtx(db, "org"), input());
    const b = createPoll(mkCtx(db, "org"), input({ title: { mn: "Хоёр", en: "Two" }, opens_at: at(24) }));
    if (!a.ok || !b.ok) throw new Error();
    setPollStatus(mkCtx(db, "org"), a.data.id, "published");
    setPollStatus(mkCtx(db, "org"), b.data.id, "published");
    vote(mkCtx(db, "mem"), { pollId: a.data.id, optionIds: ["o1"] });
    const rows = pollRows(db, NOW);
    const ra = rows.find((r) => r.id === a.data.id)!, rb = rows.find((r) => r.id === b.data.id)!;
    expect([ra.phase, ra.voters, ra.eligible]).toEqual(["open", 1, 2]);
    expect([rb.phase, rb.voters]).toEqual(["scheduled", 0]);
    expect(pollResults(db, a.data.id, "org", NOW)).toMatchObject({ voters: 1, eligible: 2 });
    expect(audienceCounts(db)).toEqual({ members: 2, community: 3, everyone: 6 - 0 });
    expect(pollPhase({ ...db.polls[0], closes_at: at(-1) }, NOW)).toBe("closed");
    expect(pollPhase({ ...db.polls[0], status: "draft" }, NOW)).toBe("draft");
  });
  it("notifyCount is what publishing really notifies: opted-out people and people already notified do not count", () => {
    db.profiles.find((p) => p.id === "m2")!.notif_prefs.announcements = false;
    const made = createPoll(mkCtx(db, "org"), input());
    if (!made.ok) throw new Error();
    const poll = db.polls[0];
    expect(audienceCounts(db).members).toBe(2);
    expect(notifyCount(db, poll)).toBe(1);
    const r = setPollStatus(mkCtx(db, "org"), made.data.id, "published");
    expect(r).toEqual({ ok: true, data: { notified: 1 } });
    expect(notifyCount(db, poll)).toBe(0); // reopening later mails nobody twice
  });
  it("filters by status chips and by title in either language", () => {
    createPoll(mkCtx(db, "org"), input({ title: { mn: "Сэдэв", en: "Topic" } }));
    const two = createPoll(mkCtx(db, "org"), input({ title: { mn: "Ресторан", en: "Lunch spot" } }));
    if (!two.ok) throw new Error();
    setPollStatus(mkCtx(db, "org"), two.data.id, "published");
    const rows = pollRows(db, NOW);
    const st = (over: Partial<ListState>): ListState => ({ ...emptyListState({ search: true, multi: { status: ["draft", "published", "closed"] } }), ...over });
    expect(filterPolls(rows, st({ multi: { status: ["draft"] } })).map((r) => r.stored)).toEqual(["draft"]);
    expect(filterPolls(rows, st({ q: "LUNCH" }))).toHaveLength(1);
    expect(filterPolls(rows, st({ q: "ресто" }))).toHaveLength(1);
    expect(filterPolls(rows, st({}))).toHaveLength(2);
  });
});

describe("poll CSV", () => {
  const publish = (over: Partial<PollInput> = {}) => {
    const r = createPoll(mkCtx(db, "org"), input({ title: { mn: "=Гарчиг", en: "=Title" }, ...over }));
    if (!r.ok) throw new Error();
    setPollStatus(mkCtx(db, "org"), r.data.id, "published");
    return r.data.id;
  };
  it("is formula-safe for titles, options and names, with a BOM and CRLF", () => {
    const id = publish({ options: [{ id: "o1", label: { mn: "+AI", en: "+AI" } }, { id: "o2", label: { mn: "Вэб", en: "Web" } }] });
    vote(mkCtx(db, "m2"), { pollId: id, optionIds: ["o1"] });
    const csv = pollResultsToCsv(db.polls[0], pollResults(db, id, "org", NOW)!, "en");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("\r\n");
    const cells = csv.slice(1).split("\r\n").flatMap((l) => l.split(","));
    expect(cells).toContain("'=Title");
    expect(cells).toContain("'+AI");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("100%");
    expect(csv.slice(1).split("\r\n").some((l) => /^[=+\-@]/.test(l))).toBe(false);
  });
  it("an anonymous poll exports totals only: no voter names, ever", () => {
    const id = publish({ anonymous: true });
    vote(mkCtx(db, "m2"), { pollId: id, optionIds: ["o2"] });
    const view = pollResults(db, id, "org", NOW)!;
    expect(view.voterList).toBeNull();
    const csv = pollResultsToCsv(db.polls[0], view, "en");
    expect(csv).not.toContain("HYPERLINK");
    expect(csv).not.toContain("m2");
    expect(csv).toContain(copy.en.results.csv.anonymousNote);
  });
});
