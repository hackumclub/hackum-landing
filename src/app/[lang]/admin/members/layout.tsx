import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { copy } from "@/i18n/areas/admin-members";
import { isLocale } from "@/i18n/config";
import { PageHeader } from "@/components/admin/members/shared";

export default async function MembersLayout({ children, params }: { children: ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const c = copy[lang].members;
  return (
    <div className="grid grid-cols-1 gap-5">
      <PageHeader title={c.title} lead={c.lead} icon="users" />
      {children}
    </div>
  );
}
