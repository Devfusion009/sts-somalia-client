import { Skeleton } from "@/components/ui/skeleton";
import {
  FormFields,
  LoadingShell,
  Section,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function BroadcastsLoading() {
  return (
    <LoadingShell label="broadcasts">
      <Title title="Broadcasts" className="font-bold" />
      <Section title="New broadcast"><FormFields labels={["Audience","Title","Message"]} button="x" /></Section>
      <Section title="Send history"><div className="space-y-3">{[0, 1, 2].map((i) => (<div key={i} className="space-y-2 border-b pb-3 last:border-0"><div className="flex gap-2"><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-24 rounded-full" /></div><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>))}</div></Section>
    </LoadingShell>
  );
}
