import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";
import { ListCardSkeleton } from "../list-skeleton";

export default function Loading() {
  return (
    <LoadingShell label="visa applications" className="mx-auto w-full max-w-7xl">
      <Title title="Visa applications" badge actions={["w-40"]} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>{[0,1,2,3].map(key => <div key={key} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
      <ListCardSkeleton rows={3} />
    </LoadingShell>
  );
}
