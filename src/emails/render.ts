// Transactional email rendering without an email framework: branded table HTML from template strings + a plain-text twin.
// Pure and synchronous so it is trivially testable. Every payload-derived string reaches HTML only through `esc`.
import { tf, type Locale } from "@/i18n/config";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";
import { googleCalendarUrl } from "@/lib/calendar/gcal";
import type { Notification, TemplateName } from "@/lib/mockdb/types";
import { SITE_URL } from "@/lib/site-url";
import { formatUb, toUbInput } from "@/lib/time";

export type EmailPayload = Notification["payload"];
export type RenderedEmail = { subject: string; html: string; text: string; ics?: IcsEvent };

export const ALL_TEMPLATES: readonly TemplateName[] = [
  "welcome", "rsvp_confirmed", "waitlist_promoted", "waitlist_notice", "application_received", "application_accepted",
  "application_rejected", "membership_approved", "membership_rejected", "event_updated", "event_cancelled",
  "reminder_24h", "announcement", "feedback_request", "poll_opened",
];

const BRAND = "#0085ca";
const BUTTON = "#00689d"; // darker than the brand blue so white button text passes AA (≥4.5:1)
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const ORGANIZER = process.env.EMAIL_ORGANIZER ?? "noreply@hackum.club";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

// ── payload access ───────────────────────────────────────────────────────────────────────────────────────────────

const str = (p: EmailPayload, k: string): string => {
  const v = p[k];
  return typeof v === "string" ? v.trim() : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
};
const date = (p: EmailPayload, k: string): Date | null => {
  const s = str(p, k);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
/** Bilingual payload pair → the requested language with the spec's fallback (empty translation shows Mongolian). */
const pick = (p: EmailPayload, base: string, lang: Locale) => tf({ mn: str(p, `${base}_mn`), en: str(p, `${base}_en`) }, lang);

// ── event facts ──────────────────────────────────────────────────────────────────────────────────────────────────

type Ev = { title: string; url: string; start: Date | null; end: Date | null; venue: string; mode: string; modeLabel: string };

const MODE: Record<string, Record<Locale, string>> = {
  offline: { mn: "Танхимаар", en: "In person" },
  online: { mn: "Онлайн", en: "Online" },
  hybrid: { mn: "Танхим + онлайн", en: "In person + online" },
};

function eventOf(p: EmailPayload, lang: Locale): Ev {
  const slug = str(p, "event_slug");
  const mode = str(p, "mode");
  return {
    title: pick(p, "event_title", lang) || (lang === "mn" ? "Hackum эвент" : "Hackum event"),
    url: slug ? `${SITE_URL}/${lang}/events/${encodeURIComponent(slug)}` : `${SITE_URL}/${lang}/events`,
    start: date(p, "starts_at"),
    end: date(p, "ends_at"),
    venue: str(p, "venue"),
    mode,
    modeLabel: MODE[mode]?.[lang] ?? "",
  };
}

/** "Tue, Dec 1, 2026, 6:00 PM – 8:00 PM (UTC+8)": Ulaanbaatar wall-clock, the end shown as time-only on the same day. */
function whenLine(e: Ev, lang: Locale): string {
  if (!e.start) return "";
  const full: Intl.DateTimeFormatOptions = { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
  const timeOnly: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  let s = formatUb(e.start, lang, full);
  if (e.end && e.end > e.start) {
    const sameDay = toUbInput(e.start).slice(0, 10) === toUbInput(e.end).slice(0, 10);
    s += ` – ${formatUb(e.end, lang, sameDay ? timeOnly : full)}`;
  }
  return `${s} (UTC+8)`;
}

function whereLine(e: Ev): string {
  return [e.venue, e.mode === "online" || e.mode === "hybrid" ? e.modeLabel : ""].filter(Boolean).join(" · ") || e.modeLabel;
}

const icsOf = (p: EmailPayload, e: Ev, method: "REQUEST" | "CANCEL"): IcsEvent | undefined => {
  const id = str(p, "event_id");
  if (!id || !e.start || !e.end) return undefined;
  return {
    uid: `${id}@hackum`,
    sequence: Math.max(0, Math.trunc(Number(p.ics_sequence) || 0)),
    start: e.start,
    end: e.end,
    title: e.title,
    description: e.url,
    location: e.venue || (e.mode === "online" ? "Online" : ""),
    url: e.url,
    method,
    organizerEmail: ORGANIZER,
  };
};

// ── copy ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type Cta = { label: string; url: string };
type Content = {
  subject: string;
  heading: string;
  paragraphs: string[];
  facts?: boolean; // show the event when/where block
  ctas: Cta[]; // first one is the primary button, the rest are plain links
};

const L = (lang: Locale, mn: string, en: string) => (lang === "mn" ? mn : en);

function content(t: TemplateName, p: EmailPayload, lang: Locale, ev: Ev): Content {
  const name = str(p, "to_name");
  const hi = name ? L(lang, `Сайн уу, ${name}.`, `Hi ${name},`) : L(lang, "Сайн уу.", "Hi,");
  const title = ev.title;
  const team = str(p, "team_name");
  const season = str(p, "season");
  const events: Cta = { label: L(lang, "Эвентүүдийг үзэх", "Browse events"), url: `${SITE_URL}/${lang}/events` };
  const page: Cta = { label: L(lang, "Эвентийн хуудас нээх", "Open event page"), url: ev.url };
  const gcal: Cta | null = ev.start && ev.end
    ? { label: L(lang, "Календарьт нэмэх", "Add to calendar"), url: googleCalendarUrl({ title, start: ev.start, end: ev.end, description: ev.url, location: ev.venue }) }
    : null;
  const withCal = (...rest: Cta[]) => (gcal ? [gcal, ...rest] : rest);
  const icsNote = L(lang, "Хавсралтын .ics файлыг Apple, Outlook зэрэг календарьт нээж нэмж болно.", "The attached .ics file opens in Apple Calendar, Outlook and others.");

  switch (t) {
    case "welcome":
      return {
        subject: L(lang, "Hackum-д тавтай морил", "Welcome to Hackum"),
        heading: L(lang, "Тавтай морил", "Welcome to Hackum"),
        paragraphs: [hi, L(lang, "Таны бүртгэл бэлэн боллоо. Удахгүй болох эвентүүдээс сонгоод нэг товшилтоор бүртгүүлээрэй.", "Your account is ready. Pick an upcoming event and RSVP in one click.")],
        ctas: [events],
      };
    case "rsvp_confirmed":
      return {
        subject: L(lang, `Бүртгэл баталгаажлаа: ${title}`, `You're going: ${title}`),
        heading: L(lang, "Таны бүртгэл баталгаажлаа", "You're going"),
        paragraphs: [hi, L(lang, `Та «${title}» эвентэд бүртгүүллээ. Хуваарь болон байршлыг доороос харна уу.`, `You're registered for ${title}. The schedule and location are below.`), icsNote],
        facts: true,
        ctas: withCal(page),
      };
    case "waitlist_promoted":
      return {
        subject: L(lang, `Суудал гарлаа, та орлоо: ${title}`, `A seat opened up: ${title}`),
        heading: L(lang, "Таны суудал баталгаажлаа", "Your seat is confirmed"),
        paragraphs: [hi, L(lang, `«${title}» эвентэд суудал чөлөөлөгдөж, таныг хүлээлгийн жагсаалтаас орууллаа. Бүртгэл одоо баталгаажсан.`, `A seat opened up for ${title} and you moved off the waitlist. Your registration is now confirmed.`), icsNote],
        facts: true,
        ctas: withCal(page),
      };
    case "waitlist_notice":
      return {
        subject: L(lang, `Хүлээлгийн жагсаалтад нэмэгдлээ: ${title}`, `You're on the waitlist: ${title}`),
        heading: L(lang, "Та хүлээлгийн жагсаалтад байна", "You're on the waitlist"),
        paragraphs: [hi, L(lang, `«${title}» эвентийн суудал дүүрсэн тул таныг хүлээлгийн жагсаалтад нэмлээ. Суудал чөлөөлөгдвөл бид танд шууд имэйлээр мэдэгдэнэ. Таны хийх зүйл алга.`, `${title} is full, so we added you to the waitlist. If a seat opens up we'll email you right away. You don't need to do anything.`)],
        facts: true,
        ctas: [page],
      };
    case "application_received": {
      const code = str(p, "invite_code");
      const teamBits: string[] = [];
      if (team) teamBits.push(L(lang, `Баг: ${team}.`, `Team: ${team}.`));
      if (code) teamBits.push(L(lang, `Багийн урилгын код: ${code}. Багийн гишүүддээ илгээгээрэй.`, `Team invite code: ${code}. Share it with your teammates.`));
      return {
        subject: L(lang, `Өргөдөл хүлээн авлаа: ${title}`, `Application received: ${title}`),
        heading: L(lang, "Өргөдлийг хүлээн авлаа", "We got your application"),
        paragraphs: [hi, L(lang, `«${title}» эвентийн өргөдлийг хүлээн авлаа. Шийдвэрийг гарсны дараа имэйлээр мэдэгдэнэ.`, `We received your application to ${title}. We'll email you the decision once it's made.`), ...teamBits],
        facts: true,
        ctas: [page],
      };
    }
    case "application_accepted":
      return {
        subject: L(lang, `Таныг сонгов: ${title}`, `You're in: ${title}`),
        heading: L(lang, "Баяр хүргэе, та орлоо", "You're in"),
        paragraphs: [hi, L(lang, `«${title}» эвентэд таны өргөдөл зөвшөөрөгдлөө.${team ? ` Баг: ${team}.` : ""} Календарьтаа хадгалаад уулзъя.`, `Your application to ${title} was accepted.${team ? ` Team: ${team}.` : ""} Save it to your calendar and we'll see you there.`), icsNote],
        facts: true,
        ctas: withCal(page),
      };
    case "application_rejected":
      return {
        subject: L(lang, `Өргөдлийн үр дүн: ${title}`, `Your application to ${title}`),
        heading: L(lang, "Өргөдлийн үр дүн", "About your application"),
        paragraphs: [
          hi,
          L(lang, `«${title}» эвентэд энэ удаа таныг сонгож чадсангүй. Өргөдөл ихтэй, суудал хязгаартай байлаа.`, `We weren't able to offer you a place at ${title} this time. We had many more applications than seats.`),
          L(lang, "Өргөдлөө илгээсэнд баярлалаа. Дараагийн эвентүүдэд дахин бүртгүүлэхийг урьж байна.", "Thank you for applying. We'd love to see you at our next events."),
        ],
        ctas: [events],
      };
    case "membership_approved":
      return {
        subject: L(lang, "Та Hackum-ын гишүүн боллоо", "You're a Hackum member"),
        heading: L(lang, "Гишүүнчлэл батлагдлаа", "Membership approved"),
        paragraphs: [hi, L(lang, `Таны гишүүнчлэлийн өргөдөл${season ? ` ${season} оны улиралд` : ""} батлагдлаа. Профайлаа шинэчилж, эвентүүдэд бүртгүүлээрэй.`, `Your membership application${season ? ` for the ${season} season` : ""} was approved. Update your profile and join our events.`)],
        ctas: [{ label: L(lang, "Профайл руу очих", "Go to your profile"), url: `${SITE_URL}/${lang}/me` }],
      };
    case "membership_rejected":
      return {
        subject: L(lang, "Гишүүнчлэлийн өргөдлийн үр дүн", "Your Hackum membership application"),
        heading: L(lang, "Өргөдлийн үр дүн", "About your application"),
        paragraphs: [
          hi,
          L(lang, `Гишүүнчлэлийн өргөдлийг${season ? ` ${season} оны улиралд` : " энэ удаа"} батлах боломжгүй байлаа.`, `We couldn't approve your membership application${season ? ` for the ${season} season` : " this time"}.`),
          L(lang, "Эвентүүд бүгдэд нээлттэй хэвээр байна. Дараагийн улиралд дахин өргөдөл гаргахыг урьж байна.", "Our events stay open to everyone, and you're welcome to apply again next season."),
        ],
        ctas: [events],
      };
    case "event_updated": {
      const changed = str(p, "changed");
      return {
        subject: L(lang, `Өөрчлөлт орлоо: ${title}`, `Updated: ${title}`),
        heading: L(lang, "Эвентийн мэдээлэл өөрчлөгдлөө", "Event details changed"),
        paragraphs: [
          hi,
          changed
            ? L(lang, `«${title}» эвентэд өөрчлөлт орлоо: ${changed}.`, `${title} changed: ${changed}.`)
            : L(lang, `«${title}» эвентийн мэдээлэл шинэчлэгдлээ. Доорх шинэ мэдээллийг шалгана уу.`, `The details for ${title} were updated. Check the new details below.`),
          L(lang, "Хавсралтын .ics файл календарьт байгаа эвентийг шинэчилнэ.", "The attached .ics file updates the event in your calendar."),
        ],
        facts: true,
        ctas: withCal(page).map((c) => (c === gcal ? { ...c, label: L(lang, "Календарь шинэчлэх", "Update calendar") } : c)),
      };
    }
    case "event_cancelled":
      return {
        subject: L(lang, `Цуцлагдлаа: ${title}`, `Cancelled: ${title}`),
        heading: L(lang, "Эвент цуцлагдлаа", "Event cancelled"),
        paragraphs: [hi, L(lang, `«${title}» эвент цуцлагдсан. Таны бүртгэл хүчингүй боллоо, хийх зүйл байхгүй. Хавсралтын .ics файл календарьнаас эвентийг арилгана.`, `${title} was cancelled and your registration is void. You don't need to do anything. The attached .ics file removes it from your calendar.`)],
        facts: true,
        ctas: [events],
      };
    case "reminder_24h":
      return {
        subject: L(lang, `Маргааш: ${title}`, `Tomorrow: ${title}`),
        heading: L(lang, "Эвент маргааш болно", "Your event is tomorrow"),
        paragraphs: [hi, L(lang, `«${title}» эвент 24 цагийн дараа эхэлнэ. Ирж чадахгүй бол эвентийн хуудсаас бүртгэлээ цуцлаарай, суудлыг өөр хүнд өгнө.`, `${title} starts in about 24 hours. If you can't make it, cancel on the event page so someone else can take your seat.`)],
        facts: true,
        ctas: [page],
      };
    case "feedback_request":
      return {
        subject: L(lang, `Сэтгэгдлээ хуваалцаарай: ${title}`, `How was it? ${title}`),
        heading: L(lang, "Эвент хэр байсан бэ?", "How was the event?"),
        paragraphs: [hi, L(lang, `«${title}» эвентэд оролцсонд баярлалаа. Нэг минутын санал асуулгад хариулбал дараагийн эвентүүд илүү сайн болно. Хариулт 14 хоногийн дотор нээлттэй.`, `Thanks for coming to ${title}. A one-minute survey makes the next events better. It stays open for 14 days.`)],
        ctas: [{ label: L(lang, "Санал өгөх", "Give feedback"), url: `${SITE_URL}/${lang}/me/events/${str(p, "event_slug")}/feedback` }],
      };
    case "poll_opened": {
      const q = pick(p, "poll_title", lang);
      return {
        subject: L(lang, `Шинэ санал асуулга: ${q}`, `New poll: ${q}`),
        heading: L(lang, "Клубийн санал асуулга", "A new club poll"),
        paragraphs: [hi, L(lang, `«${q}» санал асуулга нээгдлээ. Таны санал чухал: хэдхэн секундэд өгнө үү.`, `The poll “${q}” is open. Your vote matters; it takes a few seconds.`)],
        ctas: [{ label: L(lang, "Санал өгөх", "Vote"), url: `${SITE_URL}/${lang}/me/polls` }],
      };
    }
    case "announcement": {
      const subject = pick(p, "subject", lang) || L(lang, "Hackum-аас мэдээ", "News from Hackum");
      const body = pick(p, "body", lang);
      const paras = body.split(/\r?\n\s*\r?\n|\r?\n/).map((s) => s.trim()).filter(Boolean);
      return { subject, heading: subject, paragraphs: paras.length ? paras : [L(lang, "Hackum клубээс шинэ мэдээ байна.", "There's news from Hackum.")], ctas: [events] };
    }
  }
}

// ── layout ───────────────────────────────────────────────────────────────────────────────────────────────────────

function htmlOf(c: Content, ev: Ev, lang: Locale, settingsUrl: string): string {
  const rows: [string, string][] = [];
  if (c.facts) {
    const when = whenLine(ev, lang);
    const where = whereLine(ev);
    if (when) rows.push([L(lang, "Хэзээ", "When"), when]);
    if (where) rows.push([L(lang, "Хаана", "Where"), where]);
  }
  const facts = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border:1px solid #e3e8ee;border-radius:8px;">${rows
        .map(([k, v]) => `<tr><td style="padding:10px 14px;width:72px;color:#5b6572;font-size:14px;vertical-align:top;">${esc(k)}</td><td style="padding:10px 14px;color:#14202b;font-size:15px;font-weight:600;">${esc(v)}</td></tr>`)
        .join("")}</table>`
    : "";
  const [primary, ...more] = c.ctas;
  const button = primary
    ? `<p style="margin:8px 0 20px;"><a href="${esc(primary.url)}" style="display:inline-block;background:${BUTTON};color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;padding:12px 22px;border-radius:8px;">${esc(primary.label)}</a></p>`
    : "";
  const links = more.length
    ? `<p style="margin:0 0 8px;font-size:15px;">${more.map((m) => `<a href="${esc(m.url)}" style="color:${BUTTON};">${esc(m.label)}</a>`).join(" &nbsp;·&nbsp; ")}</p>`
    : "";
  const paras = c.paragraphs.map((s) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#14202b;">${esc(s)}</p>`).join("");
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f8;font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.paragraphs[1] ?? c.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:${BRAND};padding:18px 24px;"><img src="${SITE_URL}/img/brand/logo-128.png" width="40" height="40" alt="Hackum" style="vertical-align:middle;border:0;"> <span style="vertical-align:middle;margin-left:10px;color:#ffffff;font-size:20px;font-weight:700;font-family:${FONT};">Hackum</span></td></tr>
<tr><td style="padding:28px 24px 12px;"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#14202b;font-family:${FONT};">${esc(c.heading)}</h1>${paras}${facts}${button}${links}</td></tr>
<tr><td style="padding:16px 24px 24px;border-top:1px solid #e3e8ee;font-size:13px;line-height:1.5;color:#5b6572;">${esc(L(lang, "Та Hackum клубт бүртгэлтэй тул энэ имэйлийг авлаа.", "You're getting this because you have a Hackum account."))} <a href="${esc(settingsUrl)}" style="color:${BUTTON};">${esc(L(lang, "Мэдэгдлийн тохиргоо", "Notification settings"))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

function textOf(c: Content, ev: Ev, lang: Locale, settingsUrl: string): string {
  const out = [c.heading, "", ...c.paragraphs.flatMap((s) => [s, ""])];
  if (c.facts) {
    const when = whenLine(ev, lang);
    const where = whereLine(ev);
    if (when) out.push(`${L(lang, "Хэзээ", "When")}: ${when}`);
    if (where) out.push(`${L(lang, "Хаана", "Where")}: ${where}`);
    if (when || where) out.push("");
  }
  for (const cta of c.ctas) out.push(`${cta.label}: ${cta.url}`);
  out.push("", "--", `${L(lang, "Мэдэгдлийн тохиргоо", "Notification settings")}: ${settingsUrl}`);
  return out.join("\n");
}

export function renderEmail(template: TemplateName, payload: EmailPayload, lang: Locale): RenderedEmail {
  const ev = eventOf(payload, lang);
  const c = content(template, payload, lang, ev);
  const settingsUrl = `${SITE_URL}/${lang}/me/settings`;
  const method = template === "event_cancelled" ? "CANCEL" : ["rsvp_confirmed", "application_accepted", "waitlist_promoted", "event_updated"].includes(template) ? "REQUEST" : null;
  const ics = method ? icsOf(payload, ev, method) : undefined;
  return { subject: oneLine(c.subject), html: htmlOf(c, ev, lang, settingsUrl), text: textOf(c, ev, lang, settingsUrl), ...(ics ? { ics } : {}) };
}

/** Convenience for callers that attach the calendar file: the .ics body for a rendered email, if any. */
export const icsBody = (r: RenderedEmail): string | undefined => (r.ics ? buildIcs([r.ics]) : undefined);
