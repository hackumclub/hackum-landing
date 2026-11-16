// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { avatarFor, saveAvatar, MAX_AVATAR_BYTES, MAX_AVATAR_SIDE } from "@/lib/mockdb/avatars";
import { addProfile, addStaff, ctx, emptyDb } from "./helpers/fixture";
import { bytesOf, jpeg, png, webp } from "./helpers/images";

let db: Db;
beforeEach(() => {
  db = emptyDb();
  addStaff(db, "org", "organizer");
  addProfile(db, { id: "me", visibility: "public" });
  addProfile(db, { id: "mem", visibility: "members" });
  addProfile(db, { id: "priv", visibility: "private" });
  db.avatars = {};
});
const save = (actor: string | null, bytes: Uint8Array, mime = "image/png") => saveAvatar(ctx(db, actor), bytes, mime);

describe("saveAvatar", () => {
  it("stores a valid image, versions the URL and points the profile at it", () => {
    const r = save("me", png(256, 256));
    expect(r.ok && r.data.avatar_path).toMatch(/^\/api\/avatar\/me\?v=[0-9a-f]{12}$/);
    expect(db.profiles.find((p) => p.id === "me")!.avatar_path).toBe(r.ok ? r.data.avatar_path : "");
  });
  it("changes the version when the picture changes", () => {
    const a = save("me", png(256, 256)); const b = save("me", png(255, 255));
    expect(a.ok && b.ok && a.data.avatar_path !== b.data.avatar_path).toBe(true);
    expect(Object.keys(db.avatars)).toEqual(["me"]);
  });
  it("needs a signed-in user and only ever writes the actor's own avatar", () => {
    expect(save(null, png(10, 10))).toEqual({ ok: false, error: "unauthenticated" });
    save("me", png(10, 10));
    expect(Object.keys(db.avatars)).toEqual(["me"]);
  });
  it.each([
    ["SVG declared as PNG", bytesOf('<svg xmlns="http://www.w3.org/2000/svg"/>'), "image/png"],
    ["HTML declared as PNG", bytesOf("<html></html>"), "image/png"],
    ["a PNG declared as JPEG", png(10, 10), "image/jpeg"],
    ["a GIF mime", png(10, 10), "image/gif"],
    ["a 20000 x 20000 pixel bomb", png(20000, 20000), "image/png"],
    ["one pixel over the side limit", png(MAX_AVATAR_SIDE + 1, 10), "image/png"],
    ["a zero-size image", png(0, 10), "image/png"],
    ["more than 1 MB", Uint8Array.from([...png(10, 10), ...new Array(MAX_AVATAR_BYTES).fill(0)]), "image/png"],
    ["a WebP with EXIF", webp(10, 10, { exif: true }), "image/webp"],
  ])("rejects %s and writes nothing", (_n, bytes, mime) => {
    expect(save("me", bytes, mime)).toEqual({ ok: false, error: "invalid" });
    expect(db.avatars).toEqual({});
    expect(db.profiles.find((p) => p.id === "me")!.avatar_path).toBeNull();
  });
  it("accepts a JPEG with EXIF but stores it without", () => {
    expect(save("me", jpeg(64, 64, { exif: true }), "image/jpeg").ok).toBe(true);
    expect(Buffer.from(avatarFor(db, "me", null)!.bytes).includes(Buffer.from("Exif"))).toBe(false);
  });
});

describe("avatarFor honours profile visibility", () => {
  beforeEach(() => { for (const id of ["me", "mem", "priv"]) save(id, png(32, 32)); });
  it("public: everyone, and shared caches may keep it", () => {
    expect(avatarFor(db, "me", null)).toMatchObject({ mime: "image/png", cacheable: true });
  });
  it("members: any signed-in viewer, never cached publicly", () => {
    expect(avatarFor(db, "mem", null)).toBeNull();
    expect(avatarFor(db, "mem", "me")).toMatchObject({ cacheable: false });
  });
  it("private: only the owner and staff", () => {
    expect(avatarFor(db, "priv", null)).toBeNull();
    expect(avatarFor(db, "priv", "me")).toBeNull();
    expect(avatarFor(db, "priv", "priv")).not.toBeNull();
    expect(avatarFor(db, "priv", "org")).not.toBeNull();
  });
  it("unknown profile or no avatar: null", () => {
    expect(avatarFor(db, "nope", "org")).toBeNull();
    addProfile(db, { id: "bare", visibility: "public" });
    expect(avatarFor(db, "bare", "org")).toBeNull();
  });
});
