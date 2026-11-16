import Skeleton from "@/components/ui/Skeleton";

/** Same footprint as the loaded hub: tabs, search row, a few cards (phones) or table rows. */
export function FormsListSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-12 w-full max-w-xl rounded-full" />
      <Skeleton className="h-10 w-full max-w-xs rounded-full" />
      <Skeleton className="h-5 w-20" />
      <div className="grid gap-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28 rounded-[var(--radius-md)] md:h-14" />)}</div>
    </div>
  );
}

export function FormDetailSkeleton({ label }: { label: string }) {
  return (
    <div className="grid grid-cols-1 gap-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-28 rounded-[28px]" />
      <Skeleton className="h-12 w-72 rounded-full" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4">{["h-44", "h-44", "h-24"].map((h, i) => <Skeleton key={i} className={`${h} rounded-[var(--radius-md)]`} />)}</div>
        <Skeleton className="hidden h-72 rounded-[var(--radius-md)] xl:block" />
      </div>
    </div>
  );
}
