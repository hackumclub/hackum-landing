import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import OpsRoot from "@/components/ui/OpsRoot";
import Skeleton from "@/components/ui/Skeleton";
import MeShell from "@/components/me/MeShell";
import LiveRefresh from "@/components/live/LiveRefresh";
import { copy } from "@/i18n/areas/me";
import { isLocale, tf, type Locale } from "@/i18n/config";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { getSession } from "@/lib/server/session";

type Props = { children: ReactNode; params: Promise<{ lang: string }> };

// viewport-fit=cover makes env(safe-area-inset-bottom) real on notched phones (the bottom tab bar pads with it).
export const viewport: Viewport = { viewportFit: "cover", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: { default: copy[lang].meta.title, template: `%s | ${copy[lang].meta.title}` }, robots: { index: false, follow: false } };
}

/** Reads the session (a request-time read) behind Suspense, then draws the frame. Pages do their own sign-in / onboarding redirects. */
async function Frame({ lang, children }: { lang: Locale; children: ReactNode }) {
  const session = await getSession();
  const me = session ? getStore().read().profiles.find((p) => p.id === session.profileId) : undefined;
  const c = copy[lang];
  return (
    <MeShell
      lang={lang} t={{ ...c.nav, brand: c.meta.brand }} skip={c.meta.skip}
      user={me ? { name: tf(me.name, lang) || me.handle, avatar: me.avatar_path } : null}
      extras={<LiveRefresh />}
    >
      {children}
    </MeShell>
  );
}

export default async function MeLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang) || !mockEnabled()) notFound();
  return (
    <OpsRoot>
      <Suspense fallback={<div className="grid min-h-dvh place-items-center bg-canvas"><Skeleton className="h-8 w-48" /></div>}>
        <Frame lang={lang}>{children}</Frame>
      </Suspense>
    </OpsRoot>
  );
}
