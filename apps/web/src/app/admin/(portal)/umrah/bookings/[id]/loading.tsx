import { Skeleton } from "@/components/ui/skeleton";
import { Fields, FormFields, LoadingShell, RailSkeleton, Section } from "@/components/dashboard/admin-skeletons";

const RAIL = ["Pilgrims", "Total", "Paid", "Balance", "Payment", "Room sharing"];

export default function UmrahBookingLoading() {
  return (
    <LoadingShell label="Umrah booking" className="space-y-8">
      <div className="space-y-5">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <RailSkeleton labels={RAIL} className="lg:grid-cols-6" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Stage">
          <FormFields labels={["Move to", "Note"]} button="x" />
        </Section>
        <Section title="Stage history">
          <Skeleton className="h-32 w-full" />
        </Section>
      </div>
      <Section title="Flights">
        <Fields cols={2} labels={["Outbound", "Return", "Baggage"]} />
      </Section>
      <Section title="Pilgrims">
        <Skeleton className="h-28 w-full" />
      </Section>
      <Section title="Documents">
        <Skeleton className="h-24 w-full" />
      </Section>
    </LoadingShell>
  );
}
