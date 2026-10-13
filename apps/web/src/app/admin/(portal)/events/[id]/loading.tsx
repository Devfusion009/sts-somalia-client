import { Skeleton } from "@/components/ui/skeleton";
import { BackLink } from "@/components/back-link";
import {
  LoadingShell,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function VenueLoading() {
  return (
    <LoadingShell label="venue" className="mx-auto max-w-3xl">
      <div className="space-y-3"><BackLink href="/admin/events" label="All venues" className="mb-3" /><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-24" /></div>
      <Section title="Photos &amp; video"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => (<Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />))}</div></Section>
      <Section title="Reviews"><Skeleton className="h-20 w-full" /></Section>
    </LoadingShell>
  );
}
