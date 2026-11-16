import { notFound, redirect } from "next/navigation";
import { href, isLocale } from "@/i18n/config";

/** Old URL, kept for bookmarks and emails: the applications queue is now a tab of the Members page. */
export default async function ApplicationsRedirect({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`${href(lang, "/admin/members")}?tab=applications`);
}
