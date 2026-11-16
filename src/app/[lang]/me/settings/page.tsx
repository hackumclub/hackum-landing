import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Share, Smartphone } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import ThemeToggle from "@/components/ui/ThemeToggle";
import CalendarFeed from "@/components/me/CalendarFeed";
import PrefsForm from "@/components/me/PrefsForm";
import { IconCard, PageHeader, PageSkeleton } from "@/components/me/parts";
import { meContext } from "@/components/me/context";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: copy[lang].settings.title } : {};
}

async function Body({ params }: Props) {
  const { lang, session, db, d, c } = await meContext(params, (l) => `/${l}/me/settings`);
  const t = c.settings;
  const me = db.profiles.find((p) => p.id === session.profileId);
  if (!me) notFound();
  return (
    <div className="grid gap-5">
      <PageHeader sticker="coffee" title={t.title} />
      <PrefsForm lang={lang} initial={{ prefs: me.notif_prefs, locale: me.locale, visibility: me.visibility }} c={t} />
      <CalendarFeed path={`/api/calendar/${me.calendar_token}.ics`} siteOrigin={SITE_URL} c={t} />

      <IconCard id="theme" icon="bulb" tone="warn" title={t.themeTitle}>
        <div><ThemeToggle size="lg" labels={{ group: d.admin.theme.group, system: d.admin.theme.system, light: d.admin.theme.light, dark: d.admin.theme.dark }} /></div>
      </IconCard>

      {/* Static for now: install guidance only (a service worker / manifest ships in a later slice). */}
      <IconCard id="install" icon="computer" tone="ok" title={t.installTitle} line={t.installLine}>
        <ul className="grid gap-3 text-sm text-fg">
          <li className="flex items-start gap-3 rounded-[var(--radius-sm)] bg-panel-2 p-3"><Share aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent-fg" />{t.installIos}</li>
          <li className="flex items-start gap-3 rounded-[var(--radius-sm)] bg-panel-2 p-3"><Smartphone aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent-fg" />{t.installAndroid}</li>
        </ul>
      </IconCard>
    </div>
  );
}

export default async function SettingsPage(props: Props) {
  const { lang } = await props.params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton label={copy[lang].loading} />}>
      <Body {...props} />
    </Suspense>
  );
}
