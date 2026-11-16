// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The action layer is exercised against the real in-memory store; only the Next request APIs are replaced.
const jar = new Map<string, string>();
class Redirected extends Error { constructor(readonly to: string) { super(`redirect:${to}`); } }
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { name: k, value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Redirected(to); }, notFound: () => { throw new Error("notFound"); } }));
vi.mock("next/cache", () => ({ updateTag: () => {}, revalidateTag: () => {} }));
vi.mock("server-only", () => ({}));

const { getStore } = await import("@/lib/mockdb/store");
const actions = await import("@/lib/server/auth-actions");
const { codeErrorKey } = await import("@/components/auth/errors");

const store = () => getStore();
const db = () => store().read();
const PERSONA = "hackum-dev-as";
const uniq = (() => { let n = 0; return (p: string) => `${p}${Date.now().toString(36)}${n++}`; })();

/** Runs an action that ends in a redirect and returns where it went (or the plain result when it did not redirect). */
async function landing<T>(run: () => Promise<T>): Promise<string | T> {
  try { return await run(); } catch (e) { if (e instanceof Redirected) return e.to; throw e; }
}
const codeFor = async (email: string): Promise<string> => {
  const r = await actions.requestCodeAction({ email, lang: "en" });
  if (!r.ok || !r.devCode) throw new Error("no dev code");
  return r.devCode;
};
const wrong = (c: string) => (c === "000000" ? "111111" : "000000");

beforeEach(() => { jar.clear(); vi.stubEnv("NODE_ENV", "test"); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("sign in with an email code", () => {
  it("requestCodeAction returns the code only in mock mode", async () => {
    const r = await actions.requestCodeAction({ email: "anuujin@example.com", lang: "en" });
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.devCode).toMatch(/^\d{6}$/);
  });

  it("never reveals a code (and does nothing) when mock mode is off", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PREVIEW", "");
    const r = await actions.requestCodeAction({ email: "anuujin@example.com", lang: "en" });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/\d{6}/);
    expect(jar.size).toBe(0);
  });

  it("verifyCodeAction signs a member in and lands on /me", async () => {
    const email = db().profiles.find((p) => p.handle === "anuujin")!.email!;
    const code = await codeFor(email);
    expect(await landing(() => actions.verifyCodeAction({ email, code, lang: "en" }))).toBe("/en/me");
    expect(jar.get(PERSONA)).toBe("anuujin");
  });

  it("staff land in the backoffice, a requested same-site page wins, off-site next is ignored", async () => {
    const admin = db().profiles.find((p) => p.handle === "dev-admin")!.email!;
    expect(await landing(async () => actions.verifyCodeAction({ email: admin, code: await codeFor(admin), lang: "en" }))).toBe("/en/admin");
    const member = db().profiles.find((p) => p.handle === "anuujin")!.email!;
    expect(await landing(async () => actions.verifyCodeAction({ email: member, code: await codeFor(member), lang: "en", next: "/en/me/events" }))).toBe("/en/me/events");
    expect(await landing(async () => actions.verifyCodeAction({ email: member, code: await codeFor(member), lang: "en", next: "//evil.example/x" }))).toBe("/en/me");
    expect(await landing(async () => actions.verifyCodeAction({ email: member, code: await codeFor(member), lang: "mn", next: "https://evil.example" }))).toBe("/mn/me");
  });

  it("someone who has not finished onboarding goes there first, keeping the page they asked for", async () => {
    const who = db().profiles.find((p) => p.handle === "new-guest")!;
    if (!who.email) who.email = "new-guest@example.com";
    const code = await codeFor(who.email);
    const to = await landing(() => actions.verifyCodeAction({ email: who.email!, code, lang: "en", next: "/en/events/x" }));
    expect(String(to)).toMatch(/^\/en\/me\/onboarding/);
  });

  it("a wrong code is an inline `invalid`, sets no session, and the 6th try is rate limited", async () => {
    const email = db().profiles.find((p) => p.handle === "saraa")!.email!;
    const code = await codeFor(email);
    for (let i = 0; i < 5; i++) expect(await actions.verifyCodeAction({ email, code: wrong(code), lang: "en" })).toEqual({ ok: false, error: "invalid" });
    expect(jar.has(PERSONA)).toBe(false);
    expect(await actions.verifyCodeAction({ email, code, lang: "en" })).toEqual({ ok: false, error: "rate_limited" });
  });

  it("an unknown email cannot sign in (not_found), and a malformed code is invalid", async () => {
    const email = `${uniq("nobody")}@example.com`;
    const code = await codeFor(email);
    expect(await actions.verifyCodeAction({ email, code, lang: "en" })).toEqual({ ok: false, error: "not_found" });
    expect(await actions.verifyCodeAction({ email, code: "12ab", lang: "en" })).toEqual({ ok: false, error: "invalid" });
    expect(db().profiles.some((p) => p.email === email)).toBe(false);
  });

  it("the 6th code request within an hour is rate limited", async () => {
    const email = `${uniq("flood")}@example.com`;
    for (let i = 0; i < 5; i++) expect((await actions.requestCodeAction({ email, lang: "en" })).ok).toBe(true);
    expect(await actions.requestCodeAction({ email, lang: "en" })).toEqual({ ok: false, error: "rate_limited" });
  });

  it("maps every error code to a message key for the code step", () => {
    expect(codeErrorKey("invalid")).toBe("codeWrong");
    expect(codeErrorKey("rate_limited")).toBe("codeLocked");
    expect(codeErrorKey("not_found")).toBe("noAccount");
    expect(codeErrorKey("server")).toBe("server");
    expect(codeErrorKey("closed")).toBe("server");
  });
});

describe("sign in with a passkey", () => {
  it("is honest when the account has no passkey", async () => {
    const email = db().profiles.find((p) => p.handle === "anuujin")!.email!;
    db().profiles.find((p) => p.handle === "anuujin")!.passkeys = [];
    expect(await actions.passkeyAction({ email, lang: "en" })).toEqual({ ok: false, error: "not_found" });
    expect(jar.has(PERSONA)).toBe(false);
  });
  it("signs in when a passkey exists", async () => {
    const p = db().profiles.find((x) => x.handle === "saraa")!;
    p.passkeys = [{ id: "pk_t", label: "Laptop", created_at: new Date().toISOString() }];
    expect(await landing(() => actions.passkeyAction({ email: p.email!, lang: "en" }))).toBe("/en/me");
    expect(jar.get(PERSONA)).toBe("saraa");
    p.passkeys = [];
  });
});

describe("sign out and the demo picker", () => {
  it("signOutAction clears the session and goes home", async () => {
    jar.set(PERSONA, "anuujin");
    expect(await landing(() => actions.signOutAction({ lang: "en" }))).toBe("/en");
    expect(jar.has(PERSONA)).toBe(false);
  });

  it("signInAs with an unknown handle says so instead of bouncing silently (F-06)", async () => {
    const fd = new FormData();
    fd.set("lang", "en"); fd.set("handle", "ghost-account"); fd.set("next", "/en/me");
    const to = String(await landing(() => actions.signInAs(fd)));
    expect(to).toMatch(/^\/en\/sign-in\?/);
    expect(to).toContain("error=unknown");
    expect(jar.has(PERSONA)).toBe(false);
  });

  it("signInAs is dead outside mock mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PREVIEW", "");
    const fd = new FormData();
    fd.set("lang", "en"); fd.set("handle", "dev-admin");
    expect(await landing(() => actions.signInAs(fd))).toBe("/en");
    expect(jar.has(PERSONA)).toBe(false);
  });
});

describe("create account (join)", () => {
  const input = (over: Record<string, unknown> = {}) => ({
    lang: "en" as const,
    email: `${uniq("new")}@example.com`,
    name: { mn: "Болд", en: "Bold" },
    academic: { school_id: "num" as const, school_name: "", major_track: "software" as const, program_index: null, major_label: "Software engineering" },
    answers: { how_heard: "1" },
    motivation: "I want to build things with other students.",
    team_interest: [] as string[],
    membership_answers: {},
    ...over,
  });
  const start = async (i: ReturnType<typeof input>) => {
    const r = await actions.startJoinAction(i);
    if (!r.ok || !r.devCode) throw new Error(`start failed: ${JSON.stringify(r)}`);
    return r.devCode;
  };
  const profileOf = (email: string) => db().profiles.find((p) => p.email === email)!;

  it("a NUM student with a major gets the account, the join answers and a membership application", async () => {
    const i = input();
    const code = await start(i);
    expect(await landing(() => actions.createAccountAction({ ...i, code }))).toBe("/en/me");
    const p = profileOf(i.email);
    expect(p).toMatchObject({ status: "guest", school_id: "num", major_track: "software" });
    expect(jar.get(PERSONA)).toBe(p.handle);
    expect(db().form_submissions.find((s) => s.profile_id === p.id)?.answers).toEqual({ how_heard: "1" });
    expect(db().membership_applications.filter((a) => a.profile_id === p.id)).toHaveLength(1);
    expect(db().subscribers.some((s) => s.email === i.email)).toBe(false);
  });

  it("a student from another school is a guest and a subscriber, with no application (even if they typed a motivation)", async () => {
    const i = input({ academic: { school_id: "must", school_name: "", major_track: "software", program_index: null, major_label: "" } });
    const code = await start(i);
    expect(await landing(() => actions.createAccountAction({ ...i, code }))).toBe("/en/me");
    const p = profileOf(i.email);
    expect(p).toMatchObject({ status: "guest", school_id: "must" });
    expect(db().membership_applications.some((a) => a.profile_id === p.id)).toBe(false);
    expect(db().subscribers.some((s) => s.email === i.email)).toBe(true);
  });

  it("a NUM student who leaves the motivation empty just joins (guest + subscriber)", async () => {
    const i = input({ motivation: "" });
    const code = await start(i);
    await landing(() => actions.createAccountAction({ ...i, code }));
    const p = profileOf(i.email);
    expect(db().membership_applications.some((a) => a.profile_id === p.id)).toBe(false);
    expect(db().subscribers.some((s) => s.email === i.email)).toBe(true);
  });

  it("with the application window closed, a NUM student still gets the account and is subscribed", async () => {
    const saved = db().seasons.map((s) => ({ ...s }));
    for (const s of db().seasons) { s.application_opens_at = null; s.application_closes_at = null; }
    try {
      const i = input();
      const code = await start(i);
      await landing(() => actions.createAccountAction({ ...i, code }));
      const p = profileOf(i.email);
      expect(db().membership_applications.some((a) => a.profile_id === p.id)).toBe(false);
      expect(db().subscribers.some((s) => s.email === i.email)).toBe(true);
    } finally { db().seasons.forEach((s, k) => Object.assign(s, saved[k])); }
  });

  it("invalid input is reported per field before any code is sent or consumed", async () => {
    const bad = input({ name: { mn: " ", en: "" }, email: "not-an-email", answers: {}, academic: { school_id: "other", school_name: "", major_track: "other", program_index: null, major_label: "" } });
    const before = db().auth_codes.length;
    const r = await actions.startJoinAction(bad);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.fields).toMatchObject({ name: expect.any(String), email: expect.any(String), school_name: expect.any(String) });
    expect(db().auth_codes.length).toBe(before);
  });

  it("a required join question left empty is a field error keyed by question id", async () => {
    const form = db().forms.find((f) => f.id === "join")!;
    const original = form.questions;
    form.questions = [...original, { id: "must_answer", type: "short", required: true, label: { mn: "Заавал", en: "Required" } }];
    try {
      const r = await actions.startJoinAction(input({ answers: { how_heard: "1" } }));
      expect(r.ok).toBe(false);
      expect(!r.ok && r.fields?.answers).toEqual({ must_answer: "required" });
    } finally { form.questions = original; }
  });

  it("a wrong code creates nothing", async () => {
    const i = input();
    const code = await start(i);
    expect(await actions.createAccountAction({ ...i, code: wrong(code) })).toEqual({ ok: false, error: "invalid" });
    expect(db().profiles.some((p) => p.email === i.email)).toBe(false);
    expect(jar.has(PERSONA)).toBe(false);
  });

  it("an email that already has an account only signs in: nothing on that profile is changed", async () => {
    const anu = db().profiles.find((p) => p.handle === "anuujin")!;
    const before = { school_id: anu.school_id, major_track: anu.major_track, status: anu.status };
    const i = input({ email: anu.email!, academic: { school_id: "must", school_name: "", major_track: "other", program_index: null, major_label: "" } });
    const code = await start(i);
    expect(await landing(() => actions.createAccountAction({ ...i, code }))).toBe("/en/me");
    expect(jar.get(PERSONA)).toBe("anuujin");
    expect({ school_id: anu.school_id, major_track: anu.major_track, status: anu.status }).toEqual(before);
  });

  it("is dead outside mock mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PREVIEW", "");
    const i = input();
    expect(await actions.startJoinAction(i)).toMatchObject({ ok: false });
    expect(await actions.createAccountAction({ ...i, code: "123456" })).toMatchObject({ ok: false });
    expect(db().profiles.some((p) => p.email === i.email)).toBe(false);
  });
});
