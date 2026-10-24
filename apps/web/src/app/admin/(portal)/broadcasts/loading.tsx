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
      <Title title="Broadcasts" />
      <div className="grid items-start gap-6 lg:grid-cols-5">
        <Section title="New broadcast" className="lg:col-span-2">
          <FormFields labels={["Title", "Message (optional)", "Audience"]} />
          <div className="mt-4 flex justify-end">
            <Skeleton className="h-8 w-36 rounded-lg max-sm:h-10 max-sm:w-full" />
          </div>
        </Section>
        <Section title="Send history" className="lg:col-span-3">
          <div className="-my-3 divide-y divide-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 py-3">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                </div>
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </LoadingShell>
  );
}
