"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useOpsTheme, type ThemePref } from "./OpsRoot";
import { cx } from "./cx";

const OPTIONS: { value: ThemePref; Icon: typeof Sun }[] = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
];

/** Segmented System / Light / Dark control (a radio group, so arrow keys and screen readers work natively). */
export default function ThemeToggle({ labels, size = "md" }: { labels: Record<ThemePref | "group", string>; /** "lg" = 44px targets (member app). */ size?: "md" | "lg" }) {
  const { theme, setTheme } = useOpsTheme();
  // The stored preference lives in localStorage, which the server cannot read: the selected state is drawn only after
  // mount (before that it shows the system default the server rendered), so hydration never sees a different class.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag: intentionally flips once after hydration
  useEffect(() => setMounted(true), []);
  const selected: ThemePref = mounted ? theme : "system";
  return (
    <div role="radiogroup" aria-label={labels.group} className="inline-flex items-center gap-0.5 rounded-full bg-seg-track p-1">
      {OPTIONS.map(({ value, Icon }) => (
        <label key={value} title={labels[value]} className={cx("grid cursor-pointer place-items-center rounded-full transition-[background-color,color,box-shadow] duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent", size === "lg" ? "size-11" : "size-8", selected === value ? "bg-seg-chip text-fg shadow-raise" : "text-fg-muted hover:bg-seg-chip/50 hover:text-fg")}>
          <input type="radio" name="ops-theme" value={value} checked={selected === value} onChange={() => setTheme(value)} aria-label={labels[value]} className="sr-only" />
          <Icon aria-hidden="true" size={16} />
        </label>
      ))}
    </div>
  );
}
