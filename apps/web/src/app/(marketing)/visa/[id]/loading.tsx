import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" role="status" aria-label="Loading visa details">
      <Skeleton className="mb-5 h-4 w-36" />
      <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
        <div className="grid lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-7 bg-[#073c34] p-8 sm:p-10">
            <Skeleton className="h-3 w-32 bg-white/15" />
            <Skeleton className="h-14 w-4/5 bg-white/15" />
            <Skeleton className="h-14 w-2/3 bg-white/15" />
            <Skeleton className="h-8 w-44 bg-white/15" />
          </div>
          <Skeleton className="h-48 rounded-none lg:h-full" />
        </div>
        <div className="p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
          <Skeleton className="mt-7 h-20" />
        </div>
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_350px]">
        <div><Skeleton className="mb-6 h-8 w-60" /><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div></div>
        <Skeleton className="h-96 rounded-3xl" />
      </div>
      <span className="sr-only">Loading visa details</span>
    </div>
  );
}
