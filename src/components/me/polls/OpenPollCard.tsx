import { ButtonLink } from "@/components/ui/Button";
import Icon3D from "@/components/Icon3D";
import { fill, tf, type Locale } from "@/i18n/config";
import type { PollCardVm } from "@/lib/me/poll-view";
import { Card } from "../parts";
import { pollsCopy } from "./copy";
import { pollTimeLine } from "./time";

/** Home: the first open poll this person has not voted in, with a one-tap way in. */
export default function OpenPollCard({ vm, lang, now }: { vm: PollCardVm; lang: Locale; now: Date }) {
  const c = pollsCopy[lang];
  const title = tf(vm.title, lang);
  return (
    <Card as="article" className="flex flex-wrap items-center gap-3" style={{ background: "radial-gradient(120% 160% at 100% 0%, var(--ops-accent-soft), var(--ops-panel) 65%)" }}>
      <Icon3D name="chart" sizes="64px" className="size-14 shrink-0 drop-shadow-[0_8px_10px_rgb(0_40_70/0.25)]" />
      <div className="grid min-w-0 flex-1 basis-44 gap-1">
        <p className="font-display text-lg font-bold text-fg [overflow-wrap:anywhere]">{title}</p>
        <p className="text-sm text-fg-muted">{fill(c.homeLine, { n: vm.options.length, closes: pollTimeLine(vm, lang, now).toLowerCase() })}</p>
      </div>
      <ButtonLink href={`/${lang}/me/polls`} aria-label={fill(c.homeActionFor, { title })} size="lg" className="w-full sm:w-auto">{c.homeAction}</ButtonLink>
    </Card>
  );
}
