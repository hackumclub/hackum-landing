"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { MeCopy } from "@/i18n/areas/me";
import { switchLocale, tf, type Locale } from "@/i18n/config";
import { updateAcademicAction, updateProfileAction } from "@/lib/me/profile-actions";
import { visibleSubjects, type ProfileEditVm } from "@/lib/me/profile-edit";
import type { AcademicInput } from "@/lib/mockdb/academic";
import type { Visibility } from "@/lib/mockdb/types";
import Button from "@/components/ui/Button";
import Field, { Input, Select } from "@/components/ui/Field";
import IconButton from "@/components/ui/IconButton";
import { cx } from "@/components/ui/cx";
import { IconCard, StickyBar } from "@/components/me/parts";
import { useFocusFirstError } from "@/components/me/focus";
import { useToast } from "@/components/me/Toast";
import AvatarUploader from "./AvatarUploader";
import ProfilePreview from "./ProfilePreview";
import SchoolMajorFields from "./SchoolMajorFields";
import SemesterSubjects, { sameSemester, type SemesterDraft } from "./SemesterSubjects";

const MAX_LINKS = 6;
const LINK_KINDS = ["github", "linkedin", "website", "instagram", "facebook", "telegram", "behance", "youtube", "twitter"] as const;
type LinkRow = { rid: number; key: string; url: string };
type Errors = Partial<Record<"name" | "grad" | "top" | `link-${number}`, string>> & { academic?: Partial<Record<keyof AcademicInput, string>> };

const isHttps = (v: string) => { try { return new URL(v).protocol === "https:" && v.length <= 200; } catch { return false; } };
const linksOf = (rows: LinkRow[]) => Object.fromEntries(rows.filter((r) => r.url.trim() !== "").map((r) => [r.key, r.url.trim()]));
const toRows = (links: Record<string, string>): LinkRow[] => Object.entries(links).map(([key, url], i) => ({ rid: i, key, url }));

type Core = { name_mn: string; name_en: string; grad: string; links: Record<string, string>; visibility: Visibility; locale: Locale };
const sameCore = (a: Core, b: Core) => JSON.stringify(a) === JSON.stringify(b);
const sameAcademic = (a: AcademicInput, b: AcademicInput) => JSON.stringify(a) === JSON.stringify(b);

function Choice<T extends string>({ name, legend, value, options, onChange }: { name: string; legend: string; value: T; options: { value: T; label: string; help?: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold text-fg">{legend}</legend>
      <div className={cx("grid gap-2", options.some((o) => o.help) ? "" : "grid-cols-2")}>
        {options.map((o) => (
          <label key={o.value} className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border-2 px-3 py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", value === o.value ? "border-accent bg-accent-soft" : "border-line bg-panel-2")}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="size-4 shrink-0 accent-[var(--ops-accent)]" />
            <span className="grid gap-0.5"><span className="text-sm font-semibold text-fg">{o.label}</span>{o.help && <span className="text-sm text-fg-muted">{o.help}</span>}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The editable profile: photo, basics, school and major, links, visibility, language, and the optional semester subjects,
 * with "How others see you" following every keystroke. One Save writes academic then profile (two rules), then stays on the
 * page with a toast. Leaving with unsaved changes asks first (tab close/reload, and clicks on in-app links).
 */
export default function ProfileForm({ lang, vm, badges, c }: { lang: Locale; vm: ProfileEditVm; badges: number; c: MeCopy["profile"] }) {
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const rid = useRef(100);
  const initialCore: Core = useMemo(() => ({ name_mn: vm.name.mn, name_en: vm.name.en, grad: vm.grad_year ? String(vm.grad_year) : "", links: vm.links, visibility: vm.visibility, locale: vm.locale }), [vm]);
  const [core, setCore] = useState<Core>(initialCore);
  const [rows, setRows] = useState<LinkRow[]>(() => toRows(vm.links));
  const [academic, setAcademic] = useState<AcademicInput>(vm.academic);
  const [saved, setSaved] = useState<{ core: Core; academic: AcademicInput }>({ core: initialCore, academic: vm.academic });
  const [avatar, setAvatar] = useState<string | null>(vm.avatar);
  const [sems, setSems] = useState<SemesterDraft[]>(vm.semesters);
  const [savedSems, setSavedSems] = useState<SemesterDraft[]>(vm.semesters);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, start] = useTransition();
  useFocusFirstError(form, errors);

  const draft: Core = { ...core, links: linksOf(rows) };
  const coreDirty = !sameCore(draft, saved.core);
  const academicDirty = !sameAcademic(academic, saved.academic);
  const semsDirty = sems.some((s, i) => !sameSemester(s, savedSems[i]));
  const dirty = coreDirty || academicDirty;
  const anyDirty = dirty || semsDirty;
  const patch = (p: Partial<Core>) => setCore((x) => ({ ...x, ...p }));

  // Leave guard: closing/reloading the tab, and clicks on in-app links (capture phase, before the router sees them).
  useEffect(() => {
    if (!anyDirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return; // same page (#hash) or external new tab
      if (!window.confirm(c.leaveConfirm)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", onClick, true); };
  }, [anyDirty, c.leaveConfirm]);

  // The membership page links to #school: streamed content arrives after the browser's own anchor scroll, so do it here.
  useEffect(() => {
    if (location.hash === "#school") document.getElementById("school")?.scrollIntoView({ block: "start" });
  }, []);

  function validate(): Errors {
    const e: Errors = {};
    const gradOk = core.grad.trim() === "" || (/^\d{4}$/.test(core.grad.trim()) && +core.grad >= 2000 && +core.grad <= 2040);
    if (!core.name_mn.trim() || core.name_mn.trim().length > 80 || core.name_en.trim().length > 80) e.name = c.nameErr;
    if (!gradOk) e.grad = c.gradYearErr;
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      if (r.url.trim() === "") return;
      if (!isHttps(r.url.trim())) e[`link-${i}`] = c.linkErr;
      else if (seen.has(r.key)) e[`link-${i}`] = c.linkDup;
      seen.add(r.key);
    });
    const a: NonNullable<Errors["academic"]> = {};
    if (academic.school_id === "other" && !academic.school_name.trim()) a.school_name = c.err.invalid;
    if (academic.major_label.trim().length > 80) a.major_label = c.err.invalid;
    if (Object.keys(a).length) e.academic = a;
    return e;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    start(async () => {
      let next = saved;
      if (academicDirty) {
        const r = await updateAcademicAction(lang, academic);
        if (!r.ok) { setErrors({ top: r.message }); return; }
        next = { ...next, academic };
        setSaved(next);
      }
      if (coreDirty) {
        const r = await updateProfileAction(lang, {
          name: { mn: core.name_mn.trim(), en: core.name_en.trim() },
          grad_year: core.grad.trim() === "" ? null : Number(core.grad),
          links: draft.links, visibility: core.visibility, locale: core.locale,
        });
        if (!r.ok) { setErrors({ top: r.message }); return; }
        next = { ...next, core: draft };
        setSaved(next);
      }
      setErrors({});
      toast(c.saved);
      if (next.core.locale !== lang) router.replace(switchLocale(path, next.core.locale));
      else router.refresh();
    });
  }

  const nameShown = tf({ mn: core.name_mn, en: core.name_en }, lang).trim() || "…";
  const previewSubjects = visibleSubjects(sems.find((s) => s.current) ?? { subjects: [], shared: false }, core.visibility);
  const linkOptions = (row: LinkRow) => {
    const keys: string[] = [...LINK_KINDS];
    if (!keys.includes(row.key)) keys.push(row.key);
    return keys;
  };
  const kindLabel = (k: string) => (c.linkKinds as Record<string, string>)[k] ?? k;
  const nextKind = () => LINK_KINDS.find((k) => !rows.some((r) => r.key === k)) ?? "website";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1">
        <ProfilePreview lang={lang} c={c} name={nameShown} avatar={avatar} academic={academic} gradYear={core.grad.trim() && /^\d{4}$/.test(core.grad.trim()) ? Number(core.grad) : null} subjects={previewSubjects} visibility={core.visibility} badges={badges} />
      </div>

      <div className="grid gap-5 lg:col-start-1 lg:row-start-1">
        <form ref={form} onSubmit={submit} noValidate className="grid gap-5" aria-label={c.title}>
          <IconCard id="photo" icon="camera" tone="accent" title={c.photoTitle} line={c.photoLine}>
            <AvatarUploader lang={lang} name={nameShown} src={avatar} onChange={setAvatar} c={c} />
          </IconCard>

          <IconCard id="basics" icon="id" tone="accent" title={c.basicsTitle}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={c.nameMn} required error={errors.name}>
                {(ctl) => <Input {...ctl} className="min-h-11" maxLength={80} autoComplete="name" value={core.name_mn} onChange={(e) => patch({ name_mn: e.target.value })} />}
              </Field>
              <Field label={c.nameEn} hint={c.nameEnHint}>
                {(ctl) => <Input {...ctl} className="min-h-11" maxLength={80} lang="en" value={core.name_en} onChange={(e) => patch({ name_en: e.target.value })} />}
              </Field>
              <Field label={c.gradYear} hint={c.gradYearHint} error={errors.grad}>
                {(ctl) => <Input {...ctl} className="min-h-11" inputMode="numeric" maxLength={4} value={core.grad} onChange={(e) => patch({ grad: e.target.value.replace(/\D/g, "") })} />}
              </Field>
            </div>
          </IconCard>

          <div id="school" className="scroll-mt-24">
            <IconCard id="study" icon="grad-cap" tone="ok" title={c.schoolTitle} line={c.schoolLine}>
              <SchoolMajorFields value={academic} onChange={setAcademic} lang={lang} errors={errors.academic} />
            </IconCard>
          </div>

          <IconCard id="links" icon="link" tone="warn" title={c.linksTitle} line={c.linksLine}>
            <div className="grid gap-3">
              {rows.map((r, i) => (
                <div key={r.rid} role="group" aria-label={`${c.linkKind} ${i + 1}`} className="grid items-start gap-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
                  <Field label={c.linkKind}>
                    {(ctl) => (
                      <Select {...ctl} className="min-h-11" value={r.key} onChange={(e) => setRows((x) => x.map((y) => (y.rid === r.rid ? { ...y, key: e.target.value } : y)))}>
                        {linkOptions(r).map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label={c.linkUrl} error={errors[`link-${i}`]}>
                    {(ctl) => <Input {...ctl} className="min-h-11" type="url" inputMode="url" autoComplete="url" placeholder="https://" maxLength={200} value={r.url} onChange={(e) => setRows((x) => x.map((y) => (y.rid === r.rid ? { ...y, url: e.target.value } : y)))} />}
                  </Field>
                  <div className="sm:pt-8"><IconButton size="lg" label={c.linkRemove.replace("{n}", String(i + 1))} icon={<Trash2 size={18} />} onClick={() => setRows((x) => x.filter((y) => y.rid !== r.rid))} /></div>
                </div>
              ))}
              {rows.length === 0 && <p className="text-sm text-fg-muted">{c.linksEmpty}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" size="lg" disabled={rows.length >= MAX_LINKS} icon={<Plus aria-hidden="true" size={18} />} onClick={() => setRows((x) => [...x, { rid: rid.current++, key: nextKind(), url: "" }])}>{c.linkAdd}</Button>
                {rows.length >= MAX_LINKS && <p className="text-sm text-fg-muted">{c.linkMax}</p>}
              </div>
            </div>
          </IconCard>

          <IconCard id="visibility" icon="lock" tone="ok" title={c.visTitle}>
            <Choice name="visibility" legend={c.visTitle} value={core.visibility} onChange={(visibility) => patch({ visibility })}
              options={(["public", "members", "private"] as const).map((v) => ({ value: v, label: c.vis[v], help: c.visHelp[v] }))} />
          </IconCard>

          <IconCard id="language" icon="chat" tone="accent" title={c.langTitle} line={c.langLine}>
            <Choice name="locale" legend={c.langTitle} value={core.locale} onChange={(locale) => patch({ locale })} options={[{ value: "mn", label: "Монгол" }, { value: "en", label: "English" }]} />
          </IconCard>

          <p role="alert" className="text-sm font-bold text-danger-fg empty:hidden">{errors.top}</p>
          <StickyBar aboveTabs label={c.save}>
            <span aria-live="polite" className="flex flex-1 items-center px-3 text-sm font-semibold text-fg-muted md:px-0">{anyDirty ? c.unsavedBar : ""}</span>
            <Button type="submit" size="lg" disabled={!dirty || pending} aria-busy={pending} className="min-h-12 text-lg md:px-10"
              icon={pending ? <Loader2 aria-hidden="true" size={18} className="motion-safe:animate-spin" /> : undefined}>{pending ? c.saving : c.save}</Button>
          </StickyBar>
        </form>

        <IconCard id="subjects" icon="notebook" tone="warn" title={c.subjectsTitle} line={c.subjectsLine}>
          <SemesterSubjects lang={lang} c={c} value={sems} saved={savedSems}
            onChange={(i, next) => setSems((x) => x.map((s, j) => (j === i ? next : s)))}
            onSaved={(i, next) => { setSems((x) => x.map((s, j) => (j === i ? next : s))); setSavedSems((x) => x.map((s, j) => (j === i ? next : s))); }} />
        </IconCard>
      </div>
    </div>
  );
}
