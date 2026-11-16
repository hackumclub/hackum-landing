// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/mockdb/types";
import { saveAvatar } from "@/lib/mockdb/avatars";
import { removeAvatar } from "@/lib/mockdb/ext-avatar";
import { addProfile, ctx, emptyDb } from "./helpers/fixture";
import { png } from "./helpers/images";

let db: Db;
beforeEach(() => { db = emptyDb(); addProfile(db, { id: "me" }); addProfile(db, { id: "other" }); });

describe("removeAvatar", () => {
  it("deletes the bytes and clears the pointer of the acting profile only", () => {
    saveAvatar(ctx(db, "me"), png(10, 10), "image/png");
    saveAvatar(ctx(db, "other"), png(11, 11), "image/png");
    expect(removeAvatar(ctx(db, "me")).ok).toBe(true);
    expect(db.avatars.me).toBeUndefined();
    expect(db.profiles.find((p) => p.id === "me")!.avatar_path).toBeNull();
    expect(db.avatars.other).toBeDefined();
  });
  it("is idempotent and needs a signed-in user", () => {
    expect(removeAvatar(ctx(db, "me")).ok).toBe(true);
    expect(removeAvatar(ctx(db, null))).toEqual({ ok: false, error: "unauthenticated" });
  });
});
