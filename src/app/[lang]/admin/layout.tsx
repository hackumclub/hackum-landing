import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import OpsRoot from "@/components/ui/OpsRoot";
import AdminShell from "@/components/admin/AdminShell";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { adminPreviewAllowed } from "@/lib/admin/nav";

type Props = { children: ReactNode; params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: getDictionary(lang).admin.title, robots: { index: false, follow: false } };
}

export default async function AdminLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!isLocale(lang) || !adminPreviewAllowed()) notFound();
  const d = getDictionary(lang);
  return (
    <OpsRoot>
      <AdminShell lang={lang} t={d.admin} skip={d.nav.skip} close={d.ui.close}>{children}</AdminShell>
    </OpsRoot>
  );
}
