import Skeleton from "@/components/ui/Skeleton";

const Status = ({ label }: { label: string }) => <span className="sr-only">{label}</span>;

export function PollsListSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4" role="status" aria-live="polite">
      <Status label={label} />
      <div className="flex gap-2"><Skeleton className="h-10 w-full max-w-xs" /><Skeleton className="hidden h-9 w-24 rounded-full sm:block" /><Skeleton className="hidden h-9 w-24 rounded-full sm:block" /></div>
      <Skeleton className="h-5 w-24" />
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[68px] rounded-none" />)}
      </div>
    </div>
  );
}

export function PollBodySkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4" role="status" aria-live="polite">
      <Status label={label} />
      <Skeleton className="h-12 w-56 rounded-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-md)]" />)}</div>
      <Skeleton className="h-64 rounded-[var(--radius-md)]" />
    </div>
  );
}
