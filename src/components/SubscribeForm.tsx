"use client";
import { useId, useState } from "react";
import { fill, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import Icon3D from "./Icon3D";

type Status = "idle" | "sending" | "done";
type Errors = Partial<Record<"name" | "email" | "form", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * "Notify me about events": name + email + send, all in one row (stacked on phones), on a plain background.
 * Posts to /api/subscribe. Client checks are for friendliness only; the endpoint validates everything again.
 * A hidden `website` field is a honeypot for bots.
 */
export default function SubscribeForm({ lang, dict }: { lang: Locale; dict: Dict["subscribe"] }) {
  const id = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [who, setWho] = useState({ name: "", email: "" });

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const name = String(f.get("name") ?? "").trim();
    const email = String(f.get("email") ?? "").trim();
    const next: Errors = {};
    if (!name) next.name = dict.errors.name;
    if (!EMAIL.test(email)) next.email = dict.errors.email;
    setErrors(next);
    if (next.name || next.email) { form.querySelector<HTMLInputElement>(next.name ? "[name=name]" : "[name=email]")?.focus(); return; }

    setStatus("sending");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, lang, website: String(f.get("website") ?? "") }),
      });
      if (res.ok) { setWho({ name, email }); setStatus("done"); return; }
      const code = ((await res.json().catch(() => ({}))) as { error?: string }).error;
      setErrors(code === "email" ? { email: dict.errors.email } : code === "name" ? { name: dict.errors.name }
        : code === "rate" ? { form: dict.errors.rate } : code === "unavailable" ? { form: dict.errors.unavailable } : { form: dict.errors.server });
      setStatus("idle");
    } catch {
      setErrors({ form: dict.errors.server });
      setStatus("idle");
    }
  }

  const input = "w-full rounded-full bg-white px-5 py-3 text-ink ring-1 ring-ink/15 transition placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-500";

  if (status === "done") {
    return (
      <div role="status" className="rounded-3xl bg-white px-6 py-5 ring-1 ring-ink/10">
        <p className="font-display text-lg font-black">{dict.successTitle}</p>
        <p className="mt-1 text-muted">{fill(dict.success, who)}</p>
        <button type="button" onClick={() => { setStatus("idle"); setErrors({}); }} className="mt-3 text-sm font-bold underline decoration-2 underline-offset-4 hover:decoration-4">{dict.again}</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-describedby={`${id}-consent`}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor={`${id}-name`} className="sr-only">{dict.name}</label>
          <input id={`${id}-name`} name="name" type="text" required maxLength={80} autoComplete="name" placeholder={dict.namePh}
            aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? `${id}-name-err` : undefined} className={input} />
          {errors.name ? <p id={`${id}-name-err`} role="alert" className="mt-1.5 pl-2 text-sm font-semibold text-red-600">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="sr-only">{dict.email}</label>
          <input id={`${id}-email`} name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" placeholder={dict.emailPh}
            aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? `${id}-email-err` : undefined} className={input} />
          {errors.email ? <p id={`${id}-email-err`} role="alert" className="mt-1.5 pl-2 text-sm font-semibold text-red-600">{errors.email}</p> : null}
        </div>

        {/* Honeypot: invisible to people and assistive tech, tempting to bots. */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        </div>

        <button type="submit" disabled={status === "sending"} className="relative self-start rounded-full bg-ink px-8 py-3 font-bold text-white transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60">
          {status === "sending" ? dict.sending : dict.submit}
          {/* Corner overlay: the 3D paper plane pokes out past the button's top-right corner, like the icons on the cards. */}
          <Icon3D name="send" sizes="44px" className="pointer-events-none absolute -right-4 -top-5 h-11 w-11 rotate-6 drop-shadow-[0_6px_8px_rgb(0_0_0/0.3)]" />
        </button>
      </div>
      {errors.form ? <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200">{errors.form}</p> : null}
      <p id={`${id}-consent`} className="mt-3 text-xs leading-relaxed text-faint">{dict.consent}</p>
    </form>
  );
}
