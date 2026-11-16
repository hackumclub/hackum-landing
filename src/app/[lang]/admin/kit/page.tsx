import { notFound } from "next/navigation";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import KitGallery from "@/components/admin/KitGallery";

export default async function KitPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <KitGallery d={getDictionary(lang)} />;
}
