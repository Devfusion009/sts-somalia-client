import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" role="status" aria-label="Loading visa application">
      <Skeleton className="mb-5 h-4 w-48" />
      <div className="rounded-[1.75rem] bg-secondary p-7 sm:p-9">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-5 h-9 w-2/3" />
        <div className="mt-7 flex gap-8 border-t border-border pt-5">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-10 w-24" />)}
        </div>
      </div>
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-8 lg:p-9">
          <Skeleton className="h-7 w-52" />
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-11 w-full rounded-lg" /></div>
            ))}
          </div>
          <div className="mt-8 flex justify-between border-t border-border pt-6"><Skeleton className="h-11 w-24 rounded-xl" /><Skeleton className="h-11 w-36 rounded-xl" /></div>
        </div>
      </div>
      <span className="sr-only">Loading visa application</span>
    </div>
  );
}
