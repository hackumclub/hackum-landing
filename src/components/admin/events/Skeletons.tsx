import Skeleton from "@/components/ui/Skeleton";

const Status = ({ label }: { label: string }) => <span className="sr-only">{label}</span>;

/** Same footprint as the loaded list (tabs, filter row, table rows) so nothing jumps when data arrives. */
export function ListSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4" role="status" aria-live="polite">
      <Status label={label} />
      <Skeleton className="h-10" />
      <div className="flex gap-2"><Skeleton className="h-10 w-full max-w-xs" /><Skeleton className="hidden h-9 w-24 rounded-full sm:block" /><Skeleton className="hidden h-9 w-24 rounded-full sm:block" /></div>
      <Skeleton className="h-5 w-24" />
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line">
        {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-[68px] rounded-none" />)}
      </div>
    </div>
  );
}

export function HeaderSkeleton({ label }: { label: string }) {
  return (
    <div className="grid gap-4" role="status" aria-live="polite">
      <Status label={label} />
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-9 w-2/3 max-w-lg" />
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function FormSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]" role="status" aria-live="polite">
      <Status label={label} />
      <div className="grid gap-4">
        {["h-44", "h-56", "h-40", "h-36"].map((h) => <Skeleton key={h} className={`${h} rounded-[var(--radius-md)]`} />)}
      </div>
      <Skeleton className="hidden h-72 rounded-[var(--radius-md)] xl:block" />
    </div>
  );
}

export function RegistrationsSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4" role="status" aria-live="polite">
      <Status label={label} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[var(--radius-md)]" />)}</div>
      <Skeleton className="h-10" />
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14 rounded-none" />)}
      </div>
    </div>
  );
}

export function AnalyticsSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4" role="status" aria-live="polite">
      <Status label={label} />
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[118px] rounded-[var(--radius-md)]" />)}</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Skeleton className="h-56 rounded-[var(--radius-md)]" /><Skeleton className="h-56 rounded-[var(--radius-md)]" /></div>
      <Skeleton className="h-40 rounded-[var(--radius-md)]" />
    </div>
  );
}
