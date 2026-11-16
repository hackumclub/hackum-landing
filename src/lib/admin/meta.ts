import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { pageTitle, type PageTitleKey } from "@/i18n/areas/shell";

/** `export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "events");` */
export type AdminMetaProps = { params: Promise<{ lang: string }> };

/**
 * Title of a backoffice page: "Events | Admin". Absolute on purpose: a `title.template` in a layout does not apply to the
 * page of the *same* segment (/admin itself), so the template alone would leave the dashboard with the site title (F-19).
 */
export async function adminMeta(params: Promise<{ lang: string }>, key: PageTitleKey): Promise<{ title?: { absolute: string } }> {
  const { lang } = await params;
  return isLocale(lang) ? { title: { absolute: `${pageTitle(lang, key)} | ${getDictionary(lang).admin.title}` } } : {};
}
