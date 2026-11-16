import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import OpsRoot from "@/components/ui/OpsRoot";
import Skeleton from "@/components/ui/Skeleton";
import AdminShell from "@/components/admin/AdminShell";
import LiveRefresh from "@/components/live/LiveRefresh";
import { getDictionary } from "@/i18n";
import { isLocale, tf, type Locale } from "@/i18n/config";
import { PERSONAS } from "@/lib/mockdb/seed";
import { getStore, mockEnabled } from "@/lib/mockdb/store";
import { loadBell } from "@/lib/notifications/load";
import { getSession, requireStaffPage } from "@/lib/server/session";

type Props = { children: ReactNode; params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).admin.title;
  // Each page sets its own title (pageTitle); the template adds the area name.
  return { title: { default: t, template: `%s | ${t}` }, robots: { index: false, follow: false } };
}

/** Resolves the session (a request-time read) behind Suspense, then draws the frame. Non-staff get the ordinary 404. */
async function Frame({ lang, children }: { lang: Locale; children: ReactNode }) {
  const staff = await requireStaffPage({ lang, next: `/${lang}/admin` });
  const session = await getSession();
  await connection(); // the bell's relative times read the clock
  const d = getDictionary(lang);
  const me = getStore().read().profiles.find((p) => p.id === staff.profileId);
  return (
    <AdminShell
      lang={lang} t={d.admin} skip={d.nav.skip} close={d.ui.close}
      role={staff.staffRole ?? "organizer"}
      user={me ? { name: tf(me.name, lang) || me.handle, avatar: me.avatar_path } : null}
      bell={loadBell(staff.profileId, lang)}
      demo={{ enabled: mockEnabled(), personas: PERSONAS, current: session?.handle ?? null }}
      extras={<LiveRefresh />}
    >
      {children}
    </AdminShell>
  );
}

export default async function AdminLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang) || !mockEnabled()) notFound();
  return (
    <OpsRoot>
      <Suspense fallback={<div className="grid min-h-dvh place-items-center"><Skeleton className="h-8 w-48" /></div>}>
        <Frame lang={lang}>{children}</Frame>
      </Suspense>
    </OpsRoot>
  );
}
