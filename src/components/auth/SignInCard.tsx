"use client";
import { useState } from "react";
import Link from "next/link";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { copy } from "@/i18n/areas/public";
import { href, type Locale } from "@/i18n/config";
import EmailCodeForm from "./EmailCodeForm";
import PasskeyForm from "./PasskeyForm";

/** Logo, h1, the two sign-in methods as tabs, and the way to the sign-up form. */
export default function SignInCard({ lang, next, notice }: { lang: Locale; next?: string | null; notice?: string }) {
  const c = copy[lang].auth;
  const [tab, setTab] = useState<"code" | "passkey">("code");
  const joinHref = next ? `${href(lang, "/join")}?next=${encodeURIComponent(next)}` : href(lang, "/join");
  return (
    <div className="grid gap-6 rounded-[28px] border border-line bg-panel p-6 shadow-[var(--shadow-card)] sm:p-8">
      <div className="grid gap-3">
        <p className="flex items-center gap-2.5 font-display text-lg font-black text-fg">
          {/* eslint-disable-next-line @next/next/no-img-element -- 128px brand mark */}
          <img src="/img/brand/logo-128.png" alt="" width={32} height={32} className="size-8" />
          {c.brand}
        </p>
        <h1 className="font-display text-[clamp(26px,4vw,34px)] leading-tight font-black text-fg [overflow-wrap:anywhere]">{c.signInTitle}</h1>
        <p className="text-fg-muted">{c.signInLead}</p>
      </div>
      {notice && <p role="alert" className="rounded-[var(--radius-md)] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-fg">{notice}</p>}
      <SegmentedTabs ariaLabel={c.tabsLabel} value={tab} onChange={(k) => setTab(k === "passkey" ? "passkey" : "code")}
        items={[{ key: "code", label: c.tabCode }, { key: "passkey", label: c.tabPasskey }]} />
      <div role="tabpanel" aria-label={tab === "code" ? c.tabCode : c.tabPasskey}>
        {tab === "code" ? <EmailCodeForm lang={lang} next={next} /> : <PasskeyForm lang={lang} next={next} />}
      </div>
      <p className="text-center text-sm text-fg-muted">
        {c.createPrompt}{" "}
        <Link href={joinHref} className="inline-flex min-h-11 items-center font-bold text-accent-fg underline decoration-2 underline-offset-4">{c.createLink}</Link>
      </p>
    </div>
  );
}
