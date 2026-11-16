import { notFound, redirect } from "next/navigation";
import { href, isLocale } from "@/i18n/config";

/** Old URL, kept for bookmarks: merging is now a tab of the Members page. */
export default async function MergeRedirect({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`${href(lang, "/admin/members")}?tab=merge`);
}
