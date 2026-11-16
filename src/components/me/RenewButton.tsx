"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { renewMembershipAction } from "@/lib/me/profile-actions";
import Button from "@/components/ui/Button";
import { useToast } from "./Toast";

/** One-tap membership renewal for a current member while a season window is open. */
export default function RenewButton({ lang, label, doneLabel }: { lang: Locale; label: string; doneLabel: string }) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  function run() {
    setError(null);
    start(async () => {
      const r = await renewMembershipAction(lang);
      if (r.ok) { setDone(true); toast(doneLabel); router.refresh(); } else setError(r.message);
    });
  }
  return (
    <div className="grid justify-items-start gap-1.5">
      <Button size="lg" className="w-full sm:w-auto" onClick={run} disabled={pending || done} aria-busy={pending} icon={pending ? <Loader2 aria-hidden="true" size={16} className="motion-safe:animate-spin" /> : undefined}>{label}</Button>
      <p role="alert" className="text-sm font-semibold text-danger-fg empty:hidden">{error}</p>
    </div>
  );
}
