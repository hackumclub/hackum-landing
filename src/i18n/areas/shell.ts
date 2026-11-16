// Copy for the two app shells (context switch, avatar menu, notifications, page titles). Mongolian is the source;
// English is typed against it so a missing key fails tsc. Placeholders are filled with fill().
import type { InboxKind } from "@/lib/mockdb/types";

type KindCopy = { title: string; line: string };

const mn = {
  nav: { forms: "Маягт", analytics: "Дүн шинжилгээ", inbox: "Ирсэн мэдэгдэл" },
  ctx: { label: "Хэсэг сонгох", dashboard: "Самбар", hackum: "Hackum", site: "Сайт" },
  menu: {
    open: "Хэрэглэгчийн цэс", profile: "Профайл", notifications: "Мэдэгдэл", settings: "Тохиргоо", signOut: "Гарах",
    switchDemo: "Демо хэрэглэгч солих", switchDemoNote: "Зөвхөн туршилтын орчинд. Нэвтрэлт нь жинхэнэ биш.", current: "Одоогийн",
    language: "Хэл", signedOut: "Нэвтрээгүй",
  },
  titles: {
    dashboard: "Самбар", events: "Эвент", newEvent: "Шинэ эвент", event: "Эвент", registrations: "Бүртгэл", eventComms: "Эвентийн захидал", eventAnalytics: "Эвентийн дүн",
    members: "Гишүүд", applications: "Гишүүнчлэлийн өргөдөл", merge: "Профайл нэгтгэх", forms: "Маягт", analytics: "Дүн шинжилгээ", comms: "Захидал",
    inbox: "Ирсэн мэдэгдэл", settings: "Тохиргоо", staff: "Ажилтнууд", integrations: "Холболтууд", audit: "Үйлдлийн түүх", kit: "UI багц",
  },
  bell: {
    label: "Мэдэгдэл", labelUnread: "Мэдэгдэл, {n} уншаагүй", panel: "Сүүлийн мэдэгдлүүд", markAll: "Бүгдийг уншсан болгох", seeAll: "Бүгдийг харах",
    empty: "Шинэ мэдэгдэл алга", emptyLine: "Бүртгэл, өргөдлийн шийдвэр, эвентийн өөрчлөлт энд гарна.", unread: "Уншаагүй", close: "Хаах",
    failed: "Үйлдэл амжилтгүй боллоо. Дахин оролдоно уу.", marked: "Бүгд уншсан болгогдлоо", countChanged: "{n} уншаагүй мэдэгдэл",
  },
  page: {
    title: "Мэдэгдэл", lead: "Таны бүртгэл, өргөдөл, эвентийн мэдээ нэг дор.", staffTitle: "Ирсэн мэдэгдэл", staffLead: "Шинэ өргөдөл, амжилтгүй болсон захидал.",
    emptyTitle: "Одоогоор мэдэгдэл алга", emptyLine: "Эвентэд бүртгүүлмэгц баталгаажуулалт энд ирнэ.", emptyAction: "Эвент үзэх", staffEmptyLine: "Шинэ өргөдөл ирэх үед энд харагдана.", staffEmptyAction: "Самбар руу очих",
    loadMore: "Цааш үзэх", loading: "Ачаалж байна…", open: "Нээх", markRead: "Уншсан болгох", list: "Мэдэгдлийн жагсаалт", errorTitle: "Мэдэгдлийг ачаалж чадсангүй",
  },
  staff: {
    selfTitle: "Энэ таны өөрийн эрх", selfReason: "Өөрийн эрхийг өөрчилж болохгүй. Өөр админ хийнэ.",
    lastAdminReason: "Сүүлчийн админыг өөрчилж, хасах боломжгүй. Эхлээд өөр админ нэмнэ үү.",
  },
  kinds: {
    welcome: { title: "Тавтай морил", line: "Таны бүртгэл бэлэн боллоо." },
    rsvp_confirmed: { title: "Бүртгэл баталгаажлаа", line: "“{event}” эвентэд таны суудал баталгаажлаа." },
    waitlist_notice: { title: "Хүлээлгийн жагсаалтад орлоо", line: "“{event}” дүүрсэн тул таныг хүлээлэгт бүртгэлээ." },
    waitlist_promoted: { title: "Суудал чөлөөлөгдлөө", line: "“{event}” эвентэд таны суудал баталгаажлаа." },
    application_received: { title: "Өргөдөл хүлээн авлаа", line: "“{event}” эвентийн өргөдлийг тань хянаж байна." },
    application_accepted: { title: "Өргөдөл зөвшөөрөгдлөө", line: "“{event}” эвентэд та оролцоно." },
    application_rejected: { title: "Энэ удаад сонгогдсонгүй", line: "“{event}” эвентийн өргөдөл. Дараагийн эвентүүдэд оролцоорой." },
    membership_approved: { title: "Гишүүнчлэл батлагдлаа", line: "Та Hackum-ийн гишүүн боллоо." },
    membership_rejected: { title: "Гишүүнчлэлийн өргөдөл", line: "Энэ удаад батлагдсангүй. Дэлгэрэнгүйг үзнэ үү." },
    event_updated: { title: "Эвент өөрчлөгдлөө", line: "“{event}” эвентийн мэдээлэл шинэчлэгдлээ." },
    event_cancelled: { title: "Эвент цуцлагдлаа", line: "“{event}” эвент цуцлагдсан." },
    reminder_24h: { title: "Маргааш болно", line: "“{event}” эвент 24 цагийн дараа эхэлнэ." },
    announcement: { title: "Мэдэгдэл", line: "Hackum-ээс шинэ мэдээ ирлээ." },
    feedback_request: { title: "Эвент хэр байсан бэ?", line: "“{event}” эвентийн талаар санал өгнө үү." },
    poll_opened: { title: "Шинэ санал асуулга", line: "Клубийн шинэ санал асуулгад оролцоорой." },
    staff_application: { title: "Шинэ гишүүнчлэлийн өргөдөл", line: "{name} өргөдөл илгээлээ." },
    staff_failed_email: { title: "Захидал илгээгдсэнгүй", line: "“{template}” загварын захидал хүрсэнгүй." },
  } satisfies Record<InboxKind, KindCopy>,
  generic: { event: "эвент", person: "Хэн нэгэн", template: "захидал" },
};

const en: typeof mn = {
  nav: { forms: "Forms", analytics: "Analytics", inbox: "Inbox" },
  ctx: { label: "Choose area", dashboard: "Dashboard", hackum: "Hackum", site: "Site" },
  menu: {
    open: "Account menu", profile: "Profile", notifications: "Notifications", settings: "Settings", signOut: "Sign out",
    switchDemo: "Switch demo account", switchDemoNote: "Demo only. This is not a real sign-in.", current: "Current",
    language: "Language", signedOut: "Signed out",
  },
  titles: {
    dashboard: "Dashboard", events: "Events", newEvent: "New event", event: "Event", registrations: "Registrations", eventComms: "Event emails", eventAnalytics: "Event insights",
    members: "Members", applications: "Membership applications", merge: "Merge profiles", forms: "Forms", analytics: "Analytics", comms: "Comms",
    inbox: "Inbox", settings: "Settings", staff: "Staff", integrations: "Integrations", audit: "Audit log", kit: "UI kit",
  },
  bell: {
    label: "Notifications", labelUnread: "Notifications, {n} unread", panel: "Latest notifications", markAll: "Mark all read", seeAll: "See all",
    empty: "No new notifications", emptyLine: "RSVPs, application decisions and event changes show up here.", unread: "Unread", close: "Close",
    failed: "That did not work. Try again.", marked: "All marked as read", countChanged: "{n} unread notifications",
  },
  page: {
    title: "Notifications", lead: "Your registrations, applications and event news in one place.", staffTitle: "Inbox", staffLead: "New applications and emails that failed to send.",
    emptyTitle: "No notifications yet", emptyLine: "Your RSVP confirmations land here as soon as you sign up for an event.", emptyAction: "Browse events", staffEmptyLine: "New applications show up here when they arrive.", staffEmptyAction: "Go to the dashboard",
    loadMore: "Load more", loading: "Loading…", open: "Open", markRead: "Mark read", list: "Notification list", errorTitle: "Could not load notifications",
  },
  staff: {
    selfTitle: "This is your own access", selfReason: "You cannot change your own role. Ask another admin.",
    lastAdminReason: "The last admin cannot be changed or removed. Add another admin first.",
  },
  kinds: {
    welcome: { title: "Welcome", line: "Your account is ready." },
    rsvp_confirmed: { title: "You are going", line: "Your seat at “{event}” is confirmed." },
    waitlist_notice: { title: "You are on the waitlist", line: "“{event}” is full, so we put you on the waitlist." },
    waitlist_promoted: { title: "A seat opened up", line: "Your seat at “{event}” is confirmed." },
    application_received: { title: "Application received", line: "We are reviewing your application to “{event}”." },
    application_accepted: { title: "Application accepted", line: "You are going to “{event}”." },
    application_rejected: { title: "Not selected this time", line: "Your application to “{event}”. Come to the next events." },
    membership_approved: { title: "Membership approved", line: "You are now a Hackum member." },
    membership_rejected: { title: "Membership application", line: "Not approved this time. Open it for details." },
    event_updated: { title: "Event changed", line: "Details of “{event}” were updated." },
    event_cancelled: { title: "Event cancelled", line: "“{event}” was cancelled." },
    reminder_24h: { title: "Tomorrow", line: "“{event}” starts in 24 hours." },
    announcement: { title: "Announcement", line: "News from Hackum." },
    feedback_request: { title: "How was the event?", line: "Tell us what you thought of “{event}”." },
    poll_opened: { title: "New poll", line: "A new club poll is open: take a few seconds to vote." },
    staff_application: { title: "New membership application", line: "{name} sent an application." },
    staff_failed_email: { title: "An email did not send", line: "A “{template}” email could not be delivered." },
  },
  generic: { event: "the event", person: "Someone", template: "email" },
};

export type ShellCopy = typeof mn;
export const copy = { mn, en };
export type PageTitleKey = keyof ShellCopy["titles"];

/** Page title for a backoffice page. The layout's template appends " | Admin". */
export const pageTitle = (lang: "mn" | "en", key: PageTitleKey) => copy[lang].titles[key];

