// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Db } from "@/lib/mockdb/types";
import { saveAvatar } from "@/lib/mockdb/avatars";
import { addProfile, addStaff, ctx, emptyDb } from "./helpers/fixture";
import { png } from "./helpers/images";

let db: Db;
let actor: string | null = null;
vi.mock("@/lib/mockdb/store", () => ({ getStore: () => ({ read: () => db }), mockEnabled: () => true }));
vi.mock("@/lib/server/session", () => ({ getActorId: async () => actor }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => undefined }));

const { GET } = await import("@/app/api/avatar/[id]/route");
const call = (id: string, query = "") => GET(new NextRequest(`http://localhost/api/avatar/${id}${query}`), { params: Promise.resolve({ id }) } as never);
const etagOf = (id: string) => db.avatars[id].etag;

beforeEach(() => {
  db = emptyDb(); actor = null;
  addStaff(db, "org", "organizer");
  for (const [id, visibility] of [["pub", "public"], ["mem", "members"], ["priv", "private"]] as const) {
    addProfile(db, { id, visibility });
    saveAvatar(ctx(db, id), png(64, 64), "image/png");
  }
  addProfile(db, { id: "noavatar", visibility: "public" });
});

describe("GET /api/avatar/[id]", () => {
  it("serves a public photo to anyone, immutable only when ?v matches the etag", async () => {
    const r = await call("pub", `?v=${etagOf("pub")}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-disposition")).toBe("inline");
    expect(r.headers.get("etag")).toBe(`"${etagOf("pub")}"`);
    expect(Buffer.from(await r.arrayBuffer()).length).toBeGreaterThan(8);
  });

  it("answers no-store when ?v is missing or wrong, even for a public photo", async () => {
    for (const q of ["", "?v=deadbeef0000", `?v=${etagOf("pub")}x`]) {
      const r = await call("pub", q);
      expect(r.status, q).toBe(200);
      expect(r.headers.get("cache-control"), q).toBe("private, no-store");
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("never marks a members-only photo cacheable by shared caches", async () => {
    actor = "pub";
    const r = await call("mem", `?v=${etagOf("mem")}`);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 404 (not 403) to anonymous visitors for members-only and private photos", async () => {
    expect((await call("mem", `?v=${etagOf("mem")}`)).status).toBe(404);
    const r = await call("priv", `?v=${etagOf("priv")}`);
    expect(r.status).toBe(404);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("lets only the owner and staff see a private photo", async () => {
    actor = "mem";
    expect((await call("priv")).status).toBe(404);
    actor = "priv";
    expect((await call("priv")).status).toBe(200);
    actor = "org";
    const r = await call("priv");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("404s for unknown profiles and profiles without a photo, and never throws on odd ids", async () => {
    expect((await call("noavatar")).status).toBe(404);
    expect((await call("nobody")).status).toBe(404);
    expect((await call("..%2F..%2Fetc")).status).toBe(404);
  });

  it("answers 304 to a matching If-None-Match once access is proven", async () => {
    const req = new NextRequest("http://localhost/api/avatar/pub", { headers: { "if-none-match": `"${etagOf("pub")}"` } });
    const r = await GET(req, { params: Promise.resolve({ id: "pub" }) } as never);
    expect(r.status).toBe(304);
    const anon404 = await GET(new NextRequest("http://localhost/api/avatar/priv", { headers: { "if-none-match": `"${etagOf("priv")}"` } }), { params: Promise.resolve({ id: "priv" }) } as never);
    expect(anon404.status).toBe(404);
  });
});
