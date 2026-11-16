import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingShell label="payments and receipts" className="mx-auto w-full max-w-7xl">
      <Title title="Payments & receipts" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map(key => <Skeleton key={key} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]" aria-hidden>
        <div className="space-y-5">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <Skeleton className="h-[36rem] rounded-xl" />
      </div>
    </LoadingShell>
  );
}
