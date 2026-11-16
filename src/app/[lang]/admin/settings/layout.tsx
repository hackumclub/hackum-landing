import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/admin-members";
import { href, isLocale, type Locale } from "@/i18n/config";
import { PageHeader, SectionSkeleton, SectionTabs } from "@/components/admin/members/shared";
import { requireStaffPage } from "@/lib/server/session";

/** Settings are admin-only: organizers get the ordinary 404, header and tabs included (the gate wraps the whole frame). */
async function Gate({ lang, children }: { lang: Locale; children: ReactNode }) {
  await requireStaffPage("admin");
  const c = copy[lang].settings;
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={c.title} lead={c.lead} icon="shield" />
      <SectionTabs
        label={c.tabsLabel}
        tabs={[
          { href: href(lang, "/admin/settings"), label: c.tabs.seasons },
          { href: href(lang, "/admin/settings/staff"), label: c.tabs.staff },
          { href: href(lang, "/admin/settings/integrations"), label: c.tabs.integrations },
        ]}
      />
      {children}
    </div>
  );
}

export default async function SettingsLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].settings.loading} rows={5} />}>
      <Gate lang={lang}>{children}</Gate>
    </Suspense>
  );
}
