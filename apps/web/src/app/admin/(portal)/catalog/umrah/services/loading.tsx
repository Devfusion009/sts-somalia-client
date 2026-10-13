import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingShell,
  Section,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function PrivateUmrahServicesLoading() {
  return (
    <LoadingShell label="Private Umrah services">
      <Title title="Private Umrah services" actions={["w-32"]} />
      <Section title="Services"><div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => (<div key={i} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0"><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-72 max-w-full" /></div><Skeleton className="h-5 w-16 rounded-full" /></div>))}</div></Section>
    </LoadingShell>
  );
}
