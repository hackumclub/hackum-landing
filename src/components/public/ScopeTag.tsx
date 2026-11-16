import { GraduationCap, Globe } from "lucide-react";
import Tag from "@/components/ui/Tag";
import { copy } from "@/i18n/areas/public";
import type { Locale } from "@/i18n/config";

/**
 * Who the event is for, by school: "МУИС" (NUM students) or "All schools". The shared Tag reads the ops tokens, which the
 * public site does not define, so it sits in a light ops scope (transparent, so the glass card shows through).
 */
export default function ScopeTag({ scope, lang }: { scope: "num" | "all"; lang: Locale }) {
  const c = copy[lang].rsvp;
  return (
    <span className="ops" data-theme="light" style={{ background: "transparent" }} data-school-scope={scope}>
      <Tag tone={scope === "num" ? "accent" : "neutral"} icon={scope === "num" ? GraduationCap : Globe}>{scope === "num" ? c.scopeNum : c.scopeAll}</Tag>
    </span>
  );
}
