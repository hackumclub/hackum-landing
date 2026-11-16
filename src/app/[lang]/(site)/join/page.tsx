import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import JoinSection from "@/components/auth/JoinSection";
import SubscribeForm from "@/components/SubscribeForm";
import Skeleton from "@/components/ui/Skeleton";
import { CLUB } from "@/lib/club";
import { getDictionary } from "@/i18n";
import { copy } from "@/i18n/areas/public";
import { isLocale } from "@/i18n/config";
import { safeNext } from "@/lib/auth/landing";

export async function generateMetadata({ params }: PageProps<"/[lang]/join">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].join.metaTitle } : {};
}

async function Form({ lang, searchParams }: { lang: "mn" | "en"; searchParams: PageProps<"/[lang]/join">["searchParams"] }) {
  const q = await searchParams;
  return <JoinSection lang={lang} next={safeNext(typeof q.next === "string" ? q.next : null)} />;
}

function FormSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-5 rounded-[28px] border border-line bg-panel p-6 sm:p-8">
      <Skeleton className="h-10 w-3/4" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" />
    </div>
  );
}

export default async function Page({ params, searchParams }: PageProps<"/[lang]/join">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = copy[lang].join;
  const d = getDictionary(lang);
  return (
    <AuthShell lang={lang} wide banner={c.title}>
      <div className="grid gap-6">
        <Suspense fallback={<FormSkeleton label={c.loading} />}><Form lang={lang} searchParams={searchParams} /></Suspense>
        <section aria-labelledby="newsletter-h" className="grid gap-4 rounded-[28px] border border-line bg-panel p-6 sm:p-8">
          <div className="grid gap-1">
            <h2 id="newsletter-h" className="font-display text-lg font-black text-fg">{c.newsletterTitle}</h2>
            <p className="text-sm text-fg-muted">{c.newsletterLead}</p>
          </div>
          <SubscribeForm lang={lang} dict={d.subscribe} />
          <div className="grid gap-2">
            <p className="text-sm font-bold text-fg">{c.followUs}</p>
            <ul className="flex flex-wrap gap-2">
              {CLUB.socials.map(([label, url]) => (
                <li key={label}><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-panel px-5 text-sm font-bold text-fg hover:bg-panel-2">{label}</a></li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </AuthShell>
  );
}
