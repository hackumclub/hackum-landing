import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { getDictionary } from "@/i18n";
import { fill, href, isLocale, tf, type Locale } from "@/i18n/config";
import { copy } from "@/i18n/areas/admin-members";
import { copy as meCopy } from "@/i18n/areas/me";
import ApplicationsQueue from "@/components/admin/members/ApplicationsQueue";
import MembersDirectory from "@/components/admin/members/MembersDirectory";
import MergePanel from "@/components/admin/members/MergePanel";
import { directoryCount, loadApplications, loadDirectory, loadMerge, pendingApplicationCount } from "@/components/admin/members/data";
import { previewState } from "@/components/admin/members/preview";
import { SectionSkeleton } from "@/components/admin/members/shared";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import { requireStaffPage } from "@/lib/server/session";
import { formatUbStable } from "@/lib/time";
import { adminMeta, type AdminMetaProps } from "@/lib/admin/meta";

export const generateMetadata = ({ params }: AdminMetaProps) => adminMeta(params, "members");

type Props = { params: Promise<{ lang: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const TABS = ["directory", "applications", "merge"] as const;
type Tab = (typeof TABS)[number];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** One page, three views: `?tab=directory|applications|merge` (the old /applications and /merge URLs redirect here). */
async function Body({ lang, searchParams }: { lang: Locale; searchParams: Props["searchParams"] }) {
  const session = await requireStaffPage();
  await connection(); // "last seen", counts and the application window are per-request
  await previewState(searchParams);
  const sp = await searchParams;
  const tab: Tab = TABS.find((t) => t === first(sp.tab)) ?? "directory";
  const c = copy[lang];
  const d = getDictionary(lang);
  const base = href(lang, "/admin/members");

  return (
    <div className="grid grid-cols-1 gap-5">
      <SegmentedTabs
        ariaLabel={c.members.tabsLabel}
        value={tab}
        items={[
          { key: "directory", label: c.lists.members.tabs.directory, count: directoryCount() },
          { key: "applications", label: c.lists.members.tabs.applications, count: pendingApplicationCount() },
          { key: "merge", label: c.lists.members.tabs.merge },
        ]}
        hrefs={{ directory: `${base}?tab=directory`, applications: `${base}?tab=applications`, merge: `${base}?tab=merge` }}
      />
      {tab === "directory" && (
        <MembersDirectory
          data={loadDirectory()} lang={lang} c={c.members} common={c.common} status={d.status} lists={c.lists}
          badges={{ names: Object.fromEntries(Object.entries(meCopy[lang].badges.items).map(([k, v]) => [k, v.name])), tiers: meCopy[lang].badges.tier }}
        />
      )}
      {tab === "applications" && <ApplicationsTab lang={lang} />}
      {tab === "merge" && (session.staffRole !== "admin"
        // Organizers can read the Members area but not merge; a visit explains why.
        ? <EmptyState sticker="lock" title={c.members.merge.adminOnlyTitle} line={c.members.merge.adminOnlyLine} />
        : (
          <div className="grid gap-4">
            <p className="max-w-2xl text-sm text-fg-muted">{c.members.merge.lead}</p>
            <MergePanel data={loadMerge()} lang={lang} c={c.members.merge} common={c.common} status={d.status} />
          </div>
        ))}
    </div>
  );
}

function ApplicationsTab({ lang }: { lang: Locale }) {
  const c = copy[lang];
  const data = loadApplications();
  const w = data.window;
  const when = w.at ? formatUbStable(new Date(w.at), lang, "short") : "";
  const line = w.kind === "open" && w.label ? fill(c.members.applications.window.open, { label: tf(w.label, lang), when })
    : w.kind === "scheduled" && w.label ? fill(c.members.applications.window.scheduled, { label: tf(w.label, lang), when })
    : c.members.applications.window.closed;
  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 text-sm text-fg-muted"><Info aria-hidden="true" size={16} className="mt-0.5 shrink-0" />{line}</p>
      <ApplicationsQueue data={data} lang={lang} c={c.members.applications} common={c.common} status={getDictionary(lang).status} lists={c.lists} />
    </div>
  );
}

export default async function MembersPage({ params, searchParams }: Props) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <Suspense fallback={<SectionSkeleton label={copy[lang].members.loading} rows={8} />}>
      <Body lang={lang} searchParams={searchParams} />
    </Suspense>
  );
}
