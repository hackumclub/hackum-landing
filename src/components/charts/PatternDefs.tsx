import type { Hue } from "./tokens";
import { VAR } from "./tokens";

/** Zero-size SVG that declares one 45° hatch pattern per hue, referenced as `url(#<id>-<hue>)` from the chart's marks. */
export default function PatternDefs({ id, hues }: { id: string; hues: Hue[] }) {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        {hues.map((h) => (
          <pattern key={h} id={`${id}-${h}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" style={{ fill: "var(--ops-panel)" }} />
            <rect width="3" height="6" style={{ fill: VAR[h] }} />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}
