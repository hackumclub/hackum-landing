import { fill, type Locale } from "@/i18n/config";
import { countdown } from "@/lib/me/queries";
import type { PollCardVm } from "@/lib/me/poll-view";
import { formatUb } from "@/lib/time";
import { pollsCopy } from "./copy";

/** "Closes in 5 days", "Opens Nov 20", "Closed Nov 9": one line about time for a poll card. */
export function pollTimeLine(vm: Pick<PollCardVm, "state" | "opensAt" | "closesAt">, lang: Locale, now: Date): string {
  const c = pollsCopy[lang];
  const day = (iso: string) => formatUb(new Date(iso), lang, { month: "short", day: "numeric" });
  if (vm.state === "scheduled") return vm.opensAt ? fill(c.opensOn, { date: day(vm.opensAt) }) : c.scheduled;
  if (vm.state === "closed") return vm.closesAt && new Date(vm.closesAt) <= now ? fill(c.closedOn, { date: day(vm.closesAt) }) : c.closed;
  if (!vm.closesAt) return c.noClose;
  // `countdown` reads a start and an end; the closing time is both.
  const when = countdown({ starts_at: vm.closesAt, ends_at: vm.closesAt }, now, lang).text;
  return when ? fill(c.closesIn, { when }) : c.noClose;
}
