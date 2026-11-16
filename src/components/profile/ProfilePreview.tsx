import { GraduationCap, Medal } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import type { Locale } from "@/i18n/config";
import { plural } from "@/i18n/plural";
import type { AcademicInput } from "@/lib/mockdb/academic";
import type { Visibility } from "@/lib/mockdb/types";
import { MAJOR_TRACKS, SCHOOLS } from "@/lib/num/schools";
import Avatar from "@/components/ui/Avatar";
import Tag from "@/components/ui/Tag";

export function schoolLabel(a: Pick<AcademicInput, "school_id" | "school_name">, lang: Locale): string {
  if (a.school_id === "num") return lang === "mn" ? "МУИС" : "NUM";
  if (a.school_id === "other") return a.school_name.trim() || (SCHOOLS.find((s) => s.id === "other")?.name[lang] ?? "");
  return SCHOOLS.find((s) => s.id === a.school_id)?.name[lang] ?? "";
}

/** "How others see you": a read-only card that follows the form as it is edited. It never has controls of its own. */
export default function ProfilePreview({ lang, c, name, avatar, academic, gradYear, subjects, visibility, badges }: {
  lang: Locale; c: MeCopy["profile"]; name: string; avatar: string | null; academic: AcademicInput; gradYear: number | null;
  /** Subjects the viewer would see (already filtered by "shared" and visibility). */ subjects: string[]; visibility: Visibility; badges: number;
}) {
  const school = schoolLabel(academic, lang);
  const track = MAJOR_TRACKS.find((t) => t.id === academic.major_track)?.name[lang];
  const note = visibility === "private" ? c.previewPrivate : visibility === "members" ? c.previewMembers : c.previewAnon;
  return (
    <aside aria-labelledby="preview-title" className="grid content-start gap-3 rounded-[var(--radius-md)] border border-line bg-panel p-4 md:p-5">
      <div>
        <h2 id="preview-title" className="font-display text-lg font-bold text-fg">{c.previewTitle}</h2>
        <p className="text-sm text-fg-muted">{c.previewLine}</p>
      </div>
      <div data-testid="profile-preview" className="grid gap-3 rounded-[var(--radius-sm)] border border-line bg-panel-2 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} src={avatar} size={64} />
          <div className="grid min-w-0 gap-0.5">
            <p className="font-display text-lg leading-tight font-bold text-fg [overflow-wrap:anywhere]">{name}</p>
            {gradYear && <p className="text-sm text-fg-muted tnum">{gradYear}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {school ? <Tag tone="accent" icon={GraduationCap}>{school}</Tag> : <Tag tone="neutral">{c.previewNoSchool}</Tag>}
          {track && <Tag tone="neutral">{track}</Tag>}
          <Tag tone="warn" icon={Medal}>{plural(lang, badges, c.previewBadges)}</Tag>
        </div>
        {subjects.length > 0 && (
          <div className="grid gap-1.5">
            <p className="text-xs font-bold text-fg-muted">{c.previewSubjects}</p>
            <ul aria-label={c.previewSubjects} className="flex flex-wrap gap-1.5">{subjects.map((s) => <li key={s}><Tag>{s}</Tag></li>)}</ul>
          </div>
        )}
      </div>
      <p className="text-sm text-fg-muted">{note}</p>
    </aside>
  );
}
