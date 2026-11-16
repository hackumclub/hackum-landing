import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-url";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Share, Smartphone } from "lucide-react";
import { copy } from "@/i18n/areas/me";
import { isLocale } from "@/i18n/config";
import { PERSONAS } from "@/lib/mockdb/seed";
import { signInAs } from "@/lib/server/auth-actions";
import Button from "@/components/ui/Button";
import ThemeToggle from "@/components/ui/ThemeToggle";
import PersonaSwitcher from "@/components/live/PersonaSwitcher";
import CalendarFeed from "@/components/me/CalendarFeed";
import PrefsForm from "@/components/me/PrefsForm";
import { PageHeader, PageSkeleton } from "@/components/me/parts";
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
  const card = "grid gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5";
  return (
    <div className="grid gap-5">
      <PageHeader title={t.title} />
      <PrefsForm lang={lang} initial={{ prefs: me.notif_prefs, locale: me.locale, visibility: me.visibility }} c={t} />
      <CalendarFeed path={`/api/calendar/${me.calendar_token}.ics`} siteOrigin={SITE_URL} c={t} />

      <section className={card} aria-labelledby="theme">
        <h2 id="theme" className="font-display text-lg font-bold text-fg">{t.themeTitle}</h2>
        <div><ThemeToggle size="lg" labels={{ group: d.admin.theme.group, system: d.admin.theme.system, light: d.admin.theme.light, dark: d.admin.theme.dark }} /></div>
      </section>

      {/* Static for now: install guidance only (a service worker / manifest ships in a later slice). */}
      <section className={card} aria-labelledby="install">
        <h2 id="install" className="font-display text-lg font-bold text-fg">{t.installTitle}</h2>
        <p className="text-sm text-fg-muted">{t.installLine}</p>
        <ul className="grid gap-2 text-sm text-fg">
          <li className="flex items-start gap-2"><Share aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-fg-muted" />{t.installIos}</li>
          <li className="flex items-start gap-2"><Smartphone aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-fg-muted" />{t.installAndroid}</li>
        </ul>
      </section>

      <section className={card} aria-labelledby="demo">
        <h2 id="demo" className="font-display text-lg font-bold text-fg">{t.demoTitle}</h2>
        <p className="text-sm text-fg-muted">{t.demoLine}</p>
        <div className="flex flex-wrap items-center gap-3">
          <PersonaSwitcher lang={lang} personas={PERSONAS} current={session.handle} labels={d.admin.persona} />
          <form action={signInAs}>
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="handle" value="" />
            <Button type="submit" variant="secondary" size="lg">{t.demoSignOut}</Button>
          </form>
        </div>
      </section>
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
