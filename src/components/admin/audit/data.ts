import "server-only";
import { tf, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n";
import type { AreaCopy } from "@/i18n/areas/admin-members";
import { auditGroup, diffPairs, entityKind, formatDiffValue, humanizeCode, paginate, type AuditGroup } from "@/lib/members/format";
import { PAGE_SIZE, RANGES_MS, type AuditFilter } from "./filter";
import { profileOf } from "@/lib/mockdb/core";
import { getStore } from "@/lib/mockdb/store";
import type { Db } from "@/lib/mockdb/types";

export type AuditRowDto = {
  id: string; actor: string; action: string; entity: string; at: string;
  /** One human sentence that starts with the actor's name: "Dev Organizer approved Anuujin’s membership". */
  sentence: string; group: AuditGroup;
  diff: { key: string; label: string; before: string | null; after: string; changed: boolean }[];
};
export type AuditData = {
  rows: AuditRowDto[]; total: number; page: number; pages: number; from: number; to: number;
  actors: { id: string; name: string }[]; now: string;
};

function entityLabel(db: Db, entity: string, id: string, lang: Locale, c: AreaCopy): { label: string; name: string } {
  const kind = entityKind(entity);
  const a = c.audit;
  const person = (pid: string | null) => { const p = profileOf(db, pid); return p ? tf(p.name, lang).trim() || p.name.mn || p.handle : null; };
  let name: string | null = null;
  switch (kind) {
    case "event": { const e = db.events.find((x) => x.id === id); name = e ? tf(e.title, lang) : null; break; }
    case "registration": {
      const r = db.registrations.find((x) => x.id === id);
      const e = r && db.events.find((x) => x.id === r.event_id);
      const p = r && person(r.profile_id);
      name = r && e && p ? a.registrationOf.replace("{person}", p).replace("{event}", tf(e.title, lang)) : null;
      break;
    }
    case "profile": case "staff_role": name = person(id); break;
    case "application": { const x = db.membership_applications.find((y) => y.id === id); name = x ? person(x.profile_id) : null; break; }
    case "season": { const s = db.seasons.find((x) => String(x.year) === id); name = s ? tf(s.label, lang) : null; break; }
    case "notification": { const n = db.notifications.find((x) => x.id === id); name = n ? c.comms.templates[n.template] : null; break; }
    case "other": return { label: `${a.entities.other} · ${id}`, name: id };
  }
  const shown = name ?? `${id} (${a.entityGone})`;
  return { label: a.entityOf.replace("{kind}", a.entities[kind]).replace("{name}", shown), name: shown };
}

export function loadAudit(filter: AuditFilter, lang: Locale, c: AreaCopy, status: Dict["status"]): AuditData {
  const store = getStore();
  const db = store.read();
  const now = store.now();
  const cutoff = filter.range ? now.getTime() - RANGES_MS[filter.range] : 0;
  const matches = db.audit_log
    .filter((e) => (filter.groups.length === 0 || filter.groups.includes(auditGroup(e.action) as Exclude<AuditGroup, "other">))
      && (filter.actor === null || e.actor_profile_id === filter.actor)
      && Date.parse(e.at) >= cutoff)
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
  const { page, pages, from, to } = paginate(matches.length, filter.page, PAGE_SIZE);
  const actorName = (id: string | null) => { const p = profileOf(db, id); return p ? tf(p.name, lang).trim() || p.name.mn || p.handle : c.audit.system; };
  const words = { yes: c.audit.boolean.yes, no: c.audit.boolean.no, empty: c.common.empty };

  // Known enum-ish values read better in words (a status as its pill label, a role as its role name).
  const show = (key: string, v: unknown): string => {
    if (typeof v === "string") {
      if (key === "status" && v in status) return status[v as keyof typeof status];
      if (key === "role" && v in c.settings.staff.roles) return c.settings.staff.roles[v as keyof typeof c.settings.staff.roles];
      if (key === "template" && v in c.comms.templates) return c.comms.templates[v as keyof typeof c.comms.templates];
      if (key === "merged") return actorName(v) === c.audit.system ? v : actorName(v);
    }
    return formatDiffValue(v, lang, words);
  };

  const rows = matches.slice(from, to).map((e): AuditRowDto => {
    const actor = actorName(e.actor_profile_id);
    const action = c.audit.actions[e.action] ?? humanizeCode(e.action);
    const target = entityLabel(db, e.entity, e.entity_id, lang, c);
    const template = c.audit.sentences[e.action];
    return {
    id: e.id,
    actor,
    action,
    entity: target.label,
    sentence: template ? template.replace("{actor}", actor).replace("{target}", target.name) : c.audit.sentenceFallback.replace("{actor}", actor).replace("{action}", action),
    group: auditGroup(e.action),
    at: e.at,
    diff: diffPairs(e.diff).map((p) => ({ key: p.key, label: c.audit.keys[p.key] ?? humanizeCode(p.key), before: p.changed ? show(p.key, p.before) : null, after: show(p.key, p.after), changed: p.changed })),
    };
  });
  const actorIds = [...new Set(db.audit_log.map((e) => e.actor_profile_id).filter((x): x is string => !!x))];
  const actors = actorIds.map((id) => ({ id, name: actorName(id) })).sort((a, b) => a.name.localeCompare(b.name, lang));
  return { rows, total: matches.length, page, pages, from, to, actors, now: now.toISOString() };
}
