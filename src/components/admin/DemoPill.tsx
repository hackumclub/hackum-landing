import { FlaskConical } from "lucide-react";

/** Honest, compact marker that this screen runs on the local demo database. The full explanation is read by screen readers. */
export default function DemoPill({ title, text }: { title: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-fg" title={text}>
      <FlaskConical aria-hidden="true" size={14} />
      {title}
      <span className="sr-only">. {text}</span>
    </span>
  );
}
