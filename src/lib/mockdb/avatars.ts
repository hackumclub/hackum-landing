import { createHash } from "node:crypto";
import { err, ok, type Result } from "@/lib/result";
import { imageSize, sniffImage, stripMetadata, type ImageKind } from "@/lib/media/image";
import { audit, isStaff, profileOf, requireProfile } from "./core";
import type { Ctx, Db, StoredAvatar } from "./types";

export const MAX_AVATAR_BYTES = 1_048_576; // after the browser resized it to 512 px WebP this is normally < 60 KB
export const MAX_AVATAR_SIDE = 2048;
const MIME: Record<ImageKind, StoredAvatar["mime"]> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** Server-side gate for a profile photo: type by magic bytes, size by header, metadata stripped, own profile only. */
export function saveAvatar(ctx: Ctx, bytes: Uint8Array, declaredMime: string): Result<{ avatar_path: string }> {
  const me = requireProfile(ctx);
  if (!me.ok) return me;
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return err("invalid");
  const kind = sniffImage(bytes);
  if (!kind || MIME[kind] !== declaredMime) return err("invalid");
  const size = imageSize(bytes);
  if (!size || size.w < 1 || size.h < 1 || size.w > MAX_AVATAR_SIDE || size.h > MAX_AVATAR_SIDE) return err("invalid");
  const clean = stripMetadata(bytes);
  if (!clean || clean.length > MAX_AVATAR_BYTES) return err("invalid");
  const etag = createHash("sha1").update(clean).digest("hex").slice(0, 12);
  ctx.db.avatars[me.data.id] = { mime: MIME[kind], data: Buffer.from(clean).toString("base64"), etag };
  me.data.avatar_path = `/api/avatar/${me.data.id}?v=${etag}`;
  audit(ctx, "profile.avatar", "profiles", me.data.id);
  return ok({ avatar_path: me.data.avatar_path });
}

/** What the avatar route may serve to `viewer` (null = nobody signed in). Public photos may sit in shared caches. */
export function avatarFor(db: Db, profileId: string, viewer: string | null): { mime: StoredAvatar["mime"]; bytes: Buffer; etag: string; cacheable: boolean } | null {
  const p = profileOf(db, profileId);
  const stored = db.avatars[profileId];
  if (!p || !stored) return null;
  const allowed = p.visibility === "public" || (p.visibility === "members" && !!viewer) || (!!viewer && (viewer === p.id || isStaff(db, viewer)));
  return allowed ? { mime: stored.mime, bytes: Buffer.from(stored.data, "base64"), etag: stored.etag, cacheable: p.visibility === "public" } : null;
}
