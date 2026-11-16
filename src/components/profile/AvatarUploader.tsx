"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import type { Locale } from "@/i18n/config";
import { fill } from "@/i18n/config";
import { removeAvatarAction, uploadAvatarAction } from "@/lib/me/profile-actions";
import { ImageError, resizeImage } from "@/lib/media/resizeImage";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { useToast } from "@/components/me/Toast";

const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Profile photo: pick or drop a picture → it is cropped to a square and shrunk to ≤ 512 px WebP in the browser (EXIF is
 * dropped by the re-encode) → uploaded → the server re-validates it. One upload at a time. The preview is an object URL
 * of the *resized* picture and is revoked when replaced and on unmount. `onChange` receives the stored path (or null).
 */
export default function AvatarUploader({ lang, name, src, onChange, c }: { lang: Locale; name: string; src: string | null; onChange: (path: string | null) => void; c: MeCopy["profile"] }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false); // concurrency 1, also across drops while a request is in flight
  const urlRef = useRef<string | null>(null);
  const [preview, setPreviewState] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const setPreview = (url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
    setPreviewState(url);
  };
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  async function pick(file: File | undefined) {
    if (!file || busy.current) return;
    busy.current = true;
    setError(null);
    setWorking(true);
    try {
      const blob = await resizeImage(file);
      setPreview(URL.createObjectURL(blob)); // optimistic: the circle shows the new picture while it uploads
      const body = new FormData();
      body.set("file", new File([blob], "avatar", { type: blob.type }));
      body.set("lang", lang);
      const r = await uploadAvatarAction(body);
      if (r.ok) { onChange(r.data.avatar_path); toast(c.photoUploaded); router.refresh(); }
      else setError(r.message);
    } catch (e) {
      setError(e instanceof ImageError ? c.photoErr[e.code] : c.errInvalid.avatar);
    } finally {
      setPreview(null);
      setWorking(false);
      busy.current = false;
      if (input.current) input.current.value = ""; // picking the same file again must fire change
    }
  }

  async function remove() {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setWorking(true);
    try {
      const r = await removeAvatarAction(lang);
      if (r.ok) { onChange(null); toast(c.photoRemoved); router.refresh(); } else setError(r.message);
    } finally { setWorking(false); busy.current = false; }
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void pick(e.dataTransfer.files[0]); };
  const shown = preview ?? src;
  const hint = `${c.photoHint}`;

  return (
    <div
      role="group" aria-label={c.photoTitle} aria-busy={working}
      onDragOver={(e) => { e.preventDefault(); if (!working) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
      className={cx("grid items-center gap-4 rounded-[var(--radius-md)] border-2 border-dashed p-4 sm:grid-cols-[auto_minmax(0,1fr)]", over ? "border-accent bg-accent-soft" : "border-line bg-panel-2")}
    >
      <div className="relative mx-auto size-24 overflow-hidden rounded-full ring-2 ring-line sm:mx-0">
        <Avatar name={name} src={shown} size={96} alt={shown ? fill(c.photoAlt, { name }) : ""} className={cx(working && "opacity-60")} />
        {working && <span role="status" className="absolute inset-0 grid place-items-center"><Loader2 aria-hidden="true" size={28} className="text-accent-fg motion-safe:animate-spin" /><span className="sr-only">{c.photoUploading}</span></span>}
      </div>
      <div className="grid min-w-0 gap-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="lg" variant={src ? "secondary" : "primary"} disabled={working} onClick={() => input.current?.click()} icon={<ImagePlus aria-hidden="true" size={18} />}>
            {src ? c.photoChange : c.photoChoose}
          </Button>
          {src && <Button type="button" size="lg" variant="ghost" disabled={working} onClick={remove} icon={<Trash2 aria-hidden="true" size={18} />}>{c.photoRemove}</Button>}
        </div>
        <p className="text-sm text-fg-muted">{c.photoDrop}. {hint}</p>
        <p role="alert" className="text-sm font-semibold text-danger-fg empty:hidden">{error}</p>
        <input ref={input} hidden type="file" accept={ACCEPT} onChange={(e) => void pick(e.target.files?.[0])} data-testid="avatar-input" />
      </div>
    </div>
  );
}
