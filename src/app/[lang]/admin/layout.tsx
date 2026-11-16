import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import OpsRoot from "@/components/ui/OpsRoot";
import Skeleton from "@/components/ui/Skeleton";
import AdminShell from "@/components/admin/AdminShell";
import LiveRefresh from "@/components/live/LiveRefresh";
import PersonaSwitcher from "@/components/live/PersonaSwitcher";
import { getDictionary } from "@/i18n";
import { isLocale, type Locale } from "@/i18n/config";
import { PERSONAS } from "@/lib/mockdb/seed";
import { mockEnabled } from "@/lib/mockdb/store";
import { getSession, requireStaffPage } from "@/lib/server/session";

type Props = { children: ReactNode; params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: getDictionary(lang).admin.title, robots: { index: false, follow: false } };
}

/** Resolves the session (a request-time read) behind Suspense, then draws the frame. Non-staff get the ordinary 404. */
async function Frame({ lang, children }: { lang: Locale; children: ReactNode }) {
  await requireStaffPage();
  const session = await getSession();
  const d = getDictionary(lang);
  return (
    <AdminShell
      lang={lang} t={d.admin} skip={d.nav.skip} close={d.ui.close}
      extras={
        <>
          <LiveRefresh labels={d.admin.live} />
          <PersonaSwitcher lang={lang} personas={PERSONAS} current={session?.handle ?? null} labels={d.admin.persona} />
        </>
      }
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
