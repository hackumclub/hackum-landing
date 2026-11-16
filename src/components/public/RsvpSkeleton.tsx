/** Same footprint as the settled panel (heading, status line, button) so nothing jumps when it streams in. */
export default function RsvpSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-4">
        <div className="h-6 w-28 animate-pulse rounded-full bg-ink/10" />
        <div className="h-3 w-full animate-pulse rounded-full bg-ink/10" />
        <div className="h-[52px] w-full animate-pulse rounded-full bg-ink/10 sm:w-56" />
      </div>
    </div>
  );
}
