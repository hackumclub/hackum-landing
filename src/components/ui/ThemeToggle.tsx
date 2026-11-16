"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useOpsTheme, type ThemePref } from "./OpsRoot";
import { cx } from "./cx";

const OPTIONS: { value: ThemePref; Icon: typeof Sun }[] = [
  { value: "system", Icon: Monitor },
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
];

/** Segmented System / Light / Dark control (a radio group, so arrow keys and screen readers work natively). */
export default function ThemeToggle({ labels }: { labels: Record<ThemePref | "group", string> }) {
  const { theme, setTheme } = useOpsTheme();
  return (
    <div role="radiogroup" aria-label={labels.group} className="inline-flex rounded-[var(--radius-sm)] border border-line bg-panel-2 p-0.5">
      {OPTIONS.map(({ value, Icon }) => (
        <label key={value} title={labels[value]} className={cx("grid size-9 cursor-pointer place-items-center rounded-[8px] text-fg-muted has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent", theme === value && "bg-panel text-fg shadow-[var(--shadow-soft)]")}>
          <input type="radio" name="ops-theme" value={value} checked={theme === value} onChange={() => setTheme(value)} aria-label={labels[value]} className="sr-only" />
          <Icon aria-hidden="true" size={16} />
        </label>
      ))}
    </div>
  );
}
