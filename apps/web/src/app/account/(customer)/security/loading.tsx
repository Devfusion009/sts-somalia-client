import { ShieldCheck } from "lucide-react";
import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <LoadingShell label="security settings" className="mx-auto w-full max-w-7xl">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck className="size-7" aria-hidden /></span>
        <Title title="Security" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
        {[0, 1, 2, 3].map(key => <Skeleton key={key} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" aria-hidden>
        <Skeleton className="h-80 rounded-xl" /><Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]" aria-hidden>
        <Skeleton className="h-72 rounded-xl" /><Skeleton className="h-72 rounded-xl" />
      </div>
    </LoadingShell>
  );
}
