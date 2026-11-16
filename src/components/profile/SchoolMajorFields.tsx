"use client";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/i18n/config";
import Field, { Input, Select } from "@/components/ui/Field";
import { cx } from "@/components/ui/cx";
import type { AcademicInput } from "@/lib/mockdb/academic";
import { loadPrograms, searchPrograms, trackOf, type NumProgram } from "@/lib/num/programs";
import { isMajorTrack, isSchoolId, MAJOR_TRACKS, SCHOOLS } from "@/lib/num/schools";

const mn = {
  school: "Сургууль",
  schoolName: "Сургуулийн нэр",
  guestNote: "Гишүүн болохын тулд МУИС-д суралцаж байх ёстой. Харин зочноор хэвээр нэгдэж болно.",
  level: "Түвшин",
  bachelor: "Бакалавр",
  master: "Магистр",
  doctor: "Доктор",
  program: "МУИС-ийн хөтөлбөр",
  programHint: "Нэр эсвэл индексээр хайна уу, жишээ нь D 061302.",
  programPlaceholder: "Хөтөлбөрийн нэр эсвэл индекс",
  programList: "МУИС-ийн хөтөлбөрүүд",
  track: "Мэргэжлийн чиглэл",
  majorLabel: "Мэргэжил",
  majorLabelHint: "Өөрийн мэргэжлийг бичнэ үү.",
  source: "Эх сурвалж: МУИС Нээлттэй Өгөгдөл, CC BY-SA",
  loading: "Хөтөлбөрийг ачаалж байна",
  none: "Хөтөлбөр олдсонгүй. Түвшнээ солих эсвэл чиглэлээ «Бусад» болгож мэргэжлээ бичнэ үү.",
  results: "{n} хөтөлбөр олдлоо",
  failed: "Хөтөлбөрийн жагсаалтыг ачаалж чадсангүй. Хуудсаа дахин ачаалах эсвэл чиглэлээ «Бусад» болгож мэргэжлээ бичнэ үү.",
};
const en: typeof mn = {
  school: "School",
  schoolName: "School name",
  guestNote: "Members must study at NUM; you can still join as a guest.",
  level: "Level",
  bachelor: "Bachelor",
  master: "Master",
  doctor: "Doctor",
  program: "NUM program",
  programHint: "Search by name or index, for example D 061302.",
  programPlaceholder: "Program name or index",
  programList: "NUM programs",
  track: "Major track",
  majorLabel: "Major",
  majorLabelHint: "Write your own major.",
  source: "Source: МУИС Нээлттэй Өгөгдөл, CC BY-SA",
  loading: "Loading programs",
  none: "No program found. Switch the level, or set the track to Other and write your major.",
  results: "{n} programs found",
  failed: "The program list did not load. Reload the page, or set the track to Other and write your major.",
};
export const copy = { mn, en };

const LEVELS = ["bachelor", "master", "doctor"] as const;
const DEBOUNCE_MS = 200;

type Props = {
  value: AcademicInput;
  onChange(v: AcademicInput): void;
  lang: Locale;
  errors?: Partial<Record<keyof AcademicInput, string>>;
};

/** Controlled school + major picker. NUM students pick from the bundled NUM program list (combobox); everyone else types. */
export default function SchoolMajorFields({ value, onChange, lang, errors }: Props) {
  const c = copy[lang];
  const isNum = value.school_id === "num";
  const patch = (p: Partial<AcademicInput>) => onChange({ ...value, ...p });

  return (
    <div className="grid gap-4">
      <Field label={c.school} required error={errors?.school_id}>
        {(ctl) => (
          <Select
            {...ctl}
            className="min-h-11"
            value={value.school_id}
            onChange={(e) => {
              const id = e.target.value;
              if (!isSchoolId(id)) return;
              patch({ school_id: id, program_index: id === "num" ? value.program_index : null });
            }}
          >
            {SCHOOLS.map((s) => <option key={s.id} value={s.id}>{s.name[lang]}</option>)}
          </Select>
        )}
      </Field>

      {!isNum && (
        <>
          {value.school_id === "other" && (
            <Field label={c.schoolName} required error={errors?.school_name}>
              {(ctl) => <Input {...ctl} className="min-h-11" maxLength={80} autoComplete="organization" value={value.school_name} onChange={(e) => patch({ school_name: e.target.value })} />}
            </Field>
          )}
          <p className="rounded-[var(--radius-sm)] bg-accent-soft px-3 py-2 text-sm text-fg">{c.guestNote}</p>
        </>
      )}

      {isNum && <ProgramCombobox value={value} onChange={onChange} lang={lang} error={errors?.program_index} />}

      <Field label={c.track} required error={errors?.major_track}>
        {(ctl) => (
          <Select
            {...ctl}
            className="min-h-11"
            value={value.major_track}
            onChange={(e) => { if (isMajorTrack(e.target.value)) patch({ major_track: e.target.value }); }}
          >
            {MAJOR_TRACKS.map((t) => <option key={t.id} value={t.id}>{t.name[lang]}</option>)}
          </Select>
        )}
      </Field>

      {(!isNum || value.major_track === "other") && (
        <Field label={c.majorLabel} hint={c.majorLabelHint} error={errors?.major_label}>
          {(ctl) => <Input {...ctl} className="min-h-11" maxLength={80} value={value.major_label} onChange={(e) => patch({ major_label: e.target.value })} />}
        </Field>
      )}
    </div>
  );
}

function ProgramCombobox({ value, onChange, lang, error }: { value: AcademicInput; onChange(v: AcademicInput): void; lang: Locale; error?: string }) {
  const c = copy[lang];
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (i: number) => `${uid}-opt-${i}`;
  const [programs, setPrograms] = useState<NumProgram[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [level, setLevel] = useState<NumProgram["level"]>("bachelor");
  const [query, setQuery] = useState(value.program_index ? value.major_label : "");
  const [debounced, setDebounced] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const requested = useRef(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [query]);

  const find = (q: string) => (programs ? searchPrograms(q, lang, { level }, programs) : []);
  const results = useMemo(() => find(debounced), [programs, debounced, lang, level]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the keyboard-active option visible inside the scrolling popup.
  useEffect(() => {
    if (active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const ensureLoaded = () => {
    if (requested.current) return;
    requested.current = true;
    loadPrograms().then(setPrograms).catch(() => { requested.current = false; setFailed(true); });
  };
  const show = () => { ensureLoaded(); setOpen(true); };
  const close = () => { setOpen(false); setActive(-1); };

  const select = (p: NumProgram) => {
    const label = p.name[lang] || p.name.mn;
    onChange({ ...value, school_id: "num", program_index: p.index, major_label: label, major_track: trackOf(p) });
    setQuery(label);
    setDebounced(label);
    close();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Keyboard navigation must act on the list for what is typed now, not on the one from before the debounce.
    const pending = query !== debounced;
    const rows = pending ? find(query) : results;
    const last = rows.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (pending) setDebounced(query);
        if (!open) { show(); setActive(last >= 0 ? 0 : -1); } else setActive(last < 0 ? -1 : pending || active >= last ? 0 : active + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (pending) setDebounced(query);
        if (!open) { show(); setActive(last); } else setActive(last < 0 ? -1 : pending || active <= 0 ? last : active - 1);
        break;
      case "Home":
        if (open && active >= 0) { e.preventDefault(); setActive(0); }
        break;
      case "End":
        if (open && active >= 0) { e.preventDefault(); setActive(last); }
        break;
      case "Enter":
        if (open && active >= 0 && results[active]) { e.preventDefault(); select(results[active]); }
        break;
      case "Escape":
        if (open) { e.preventDefault(); e.stopPropagation(); close(); }
        break;
    }
  };

  const status = !programs ? (failed ? c.failed : c.loading) : results.length === 0 ? c.none : c.results.replace("{n}", String(results.length));

  return (
    <div className="grid gap-4">
      <div role="group" aria-label={c.level} className="inline-grid w-full grid-cols-3 gap-1 rounded-full border border-line bg-panel-2 p-1">
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={level === l}
            onClick={() => { setLevel(l); setActive(-1); }}
            className={cx(
              "min-h-11 rounded-full px-3 text-sm font-semibold transition-colors",
              level === l ? "bg-accent text-on-accent" : "text-fg-muted hover:bg-neutral-soft hover:text-fg",
            )}
          >
            {c[l]}
          </button>
        ))}
      </div>

      <Field label={c.program} hint={c.programHint} error={error}>
        {(ctl) => (
          <div
            className="relative"
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}
          >
            <Input
              {...ctl}
              role="combobox"
              aria-expanded={open}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
              autoComplete="off"
              spellCheck={false}
              className="min-h-11"
              placeholder={c.programPlaceholder}
              value={query}
              onFocus={ensureLoaded}
              onClick={show}
              onKeyDown={onKeyDown}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(-1);
                show();
                // Free typing breaks the link to the chosen program: never keep a stale index.
                if (value.program_index !== null) onChange({ ...value, program_index: null });
              }}
            />
            <span role="status" aria-live="polite" className="sr-only">{open ? status : ""}</span>
            {open && (
              <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-[var(--radius-sm)] border border-line-strong bg-panel shadow-lg">
                <ul id={listId} role="listbox" aria-label={c.programList} className="max-h-72 overflow-y-auto overscroll-contain py-1">
                  {results.map((p, i) => (
                    <li
                      key={`${p.index}-${p.level}-${p.name.mn}`}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => select(p)}
                      onMouseMove={() => { if (active !== i) setActive(i); }}
                      className={cx("grid min-h-11 cursor-pointer gap-0.5 px-3 py-2 text-fg", i === active && "bg-accent-soft")}
                    >
                      <span className="flex items-baseline gap-2">
                        <span className="tnum shrink-0 text-xs font-semibold text-fg-muted">{p.index}</span>
                        <span className="text-sm font-semibold [overflow-wrap:anywhere]">{p.name[lang] || p.name.mn}</span>
                      </span>
                      {p.unit && <span className="text-xs text-fg-muted [overflow-wrap:anywhere]">{p.unit}</span>}
                    </li>
                  ))}
                </ul>
                {results.length === 0 && (
                  <p aria-hidden="true" className="px-3 py-3 text-sm text-fg-muted">{programs ? c.none : failed ? c.failed : c.loading}</p>
                )}
                <p className="border-t border-line bg-panel-2 px-3 py-2 text-xs text-fg-muted">{c.source}</p>
              </div>
            )}
          </div>
        )}
      </Field>
    </div>
  );
}
