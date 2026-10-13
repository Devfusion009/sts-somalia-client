import { Skeleton } from "@/components/ui/skeleton";
import {
  DetailHead,
  Fields,
  FormFields,
  LoadingShell,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function UmrahBookingLoading() {
  return (
    <LoadingShell label="Umrah booking">
      <DetailHead back="x" badges={2} actions={["w-28"]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Stage"><FormFields labels={["Stage","Note"]} button="x" /></Section>
        <Section title="Stage history"><Skeleton className="h-32 w-full" /></Section>
      </div>
      <Section title="Flights"><Fields cols={2} labels={["Outbound","Return","Baggage"]} /></Section>
      <Section title="Pilgrims"><Skeleton className="h-28 w-full" /></Section>
      <Section title="Documents"><Skeleton className="h-24 w-full" /></Section>
    </LoadingShell>
  );
}
