// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Question } from "@/lib/events/questions";
import type { Db } from "@/lib/mockdb/types";
import { err } from "@/lib/result";
import { addEvent, addProfile, addStaff, at, emptyDb, NOW } from "./helpers/fixture";

let db: Db;
let actor: string | null;
let enabled = true;
vi.mock("@/lib/server/session", () => ({
  requireStaffAction: async () => {
    if (!actor) return err("unauthenticated");
    return db.staff_roles.some((r) => r.profile_id === actor) ? { ok: true, data: { profileId: actor } } : err("forbidden");
  },
}));
vi.mock("@/lib/mockdb/store", () => ({ getStore: () => ({ read: () => db, now: () => NOW }), mockEnabled: () => enabled }));
const { GET } = await import("@/app/api/admin/forms/[id]/csv/route");

const q = (id: string, over: Partial<Question> = {}): Question => ({ id, type: "short", label: { mn: `Асуулт ${id}`, en: `Question ${id}` }, required: false, ...over });
/** `Response.text()` strips a BOM, so read the bytes: staff open this in Excel and the BOM is what makes Cyrillic show up. */
const bytes = async (res: Response) => new Uint8Array(await res.arrayBuffer());
const textKeepingBom = async (res: Response) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(await bytes(res));
const call = (id: string, query = "") => GET(new Request(`http://localhost/api/admin/forms/${encodeURIComponent(id)}/csv${query}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  enabled = true;
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "mem", status: "member" });
  addProfile(db, { id: "ana", name: { mn: "Анна", en: "Anna" } });
  db.forms = [
    { id: "membership_application", kind: "membership_application", title: { mn: "Гишүүнчлэл", en: "Membership" }, questions: [q("why")], updated_at: at(-10), updated_by: null },
    { id: "join", kind: "join", title: { mn: "Нэгдэх", en: "Join" }, questions: [q("heard")], updated_at: at(-10), updated_by: null },
  ];
  db.membership_applications.push({ id: "ma1", profile_id: "ana", season: 2027, status: "pending", motivation: "", team_interest: [], answers: { why: "=1+1", gone: "Ө Ү" }, created_at: at(-3), reviewed_by: null, reviewed_at: null } as never);
  addEvent(db, { id: "e1", slug: "x", questions: [q("a")] });
  actor = "org";
});

describe("GET /api/admin/forms/[id]/csv", () => {
  it("staff get a UTF-8 CSV attachment with a BOM, the header row first, and no caching", async () => {
    const res = await call("membership_application", "?lang=en");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="hackum-membership_application-2026-11-16.csv"');
    const text = await textKeepingBom(res);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).split("\r\n");
    expect(lines[0]).toBe("Name,Submitted,Status,Question why,Removed question: gone");
    expect(lines[1]).toContain("Anna");
    expect(lines[1]).toContain("'=1+1"); // formula-safe
    expect(lines[1]).toContain("Ө Ү");
  });
  it("uses the requested language, Mongolian by default", async () => {
    expect((await textKeepingBom(await call("join"))).slice(1).split("\r\n")[0]).toBe("Нэр,Илгээсэн,Төлөв,Асуулт heard");
    expect((await textKeepingBom(await call("join", "?lang=xx"))).slice(1).split("\r\n")[0]).toContain("Нэр");
  });
  it("event forms work and the filename has no colon", async () => {
    const res = await call("event:e1", "?lang=en");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="hackum-event-e1-2026-11-16.csv"');
  });
  it("401 signed out, 403 for a signed-in non-staff person, with nothing leaked", async () => {
    actor = null;
    const a = await call("join");
    expect(a.status).toBe(401);
    expect(await a.text()).not.toContain("heard");
    actor = "mem";
    const b = await call("join");
    expect(b.status).toBe(403);
    expect(b.headers.get("Content-Type")).not.toContain("text/csv");
    expect(b.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each(["event:nope", "nope", "event:", "event:../../x", "membership_application%00"])("unknown or malformed id %s → 404", async (id) => {
    expect((await call(id)).status).toBe(404);
  });
  it("404 when the mock backend is off", async () => {
    enabled = false;
    expect((await call("join")).status).toBe(404);
  });
});
