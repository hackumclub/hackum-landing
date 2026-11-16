import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/admin-members";
import { isLocale, href, type Locale } from "@/i18n/config";
import { PageHeader, SectionTabs } from "@/components/admin/members/shared";
import { pendingApplicationCount } from "@/components/admin/members/data";
import { requireStaffPage } from "@/lib/server/session";
import Skeleton from "@/components/ui/Skeleton";

/** Tabs need the session (admin or organizer) and the pending count: request-time reads, so they stream behind Suspense. */
async function Tabs({ lang }: { lang: Locale }) {
  const session = await requireStaffPage();
  const c = copy[lang].members;
  return (
    <SectionTabs
      label={c.tabsLabel}
      tabs={[
        { href: href(lang, "/admin/members"), label: c.tabs.directory },
        { href: href(lang, "/admin/members/applications"), label: c.tabs.applications, count: pendingApplicationCount() },
        { href: href(lang, "/admin/members/merge"), label: c.tabs.merge, disabledReason: session.staffRole === "admin" ? undefined : c.mergeAdminOnly },
      ]}
    />
  );
}

export default async function MembersLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = copy[lang].members;
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={c.title} lead={c.lead} />
      <Suspense fallback={<Skeleton className="h-10" />}><Tabs lang={lang} /></Suspense>
      {children}
    </div>
  );
}
