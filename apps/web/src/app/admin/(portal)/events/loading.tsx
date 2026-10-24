import { Skeleton } from "@/components/ui/skeleton";
import {
  Chips,
  DataTable,
  LoadingShell,
  PillCell,
  StatStrip,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function EventsLoading() {
  return (
    <LoadingShell label="events" className="space-y-8">
      <div className="space-y-6">
        <Title title="Events & Halls" actions={["w-28"]} />
        <StatStrip labels={["Venues", "Published", "Towns", "Awaiting decision"]} />
      </div>
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold">Venues</h2>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
        <Skeleton className="h-8 w-full max-w-xl rounded-lg max-sm:h-10" />
        <Chips labels={["All", "Published", "Draft", "Pending review", "Suspended"]} />
        <DataTable headers={["Venue", "Town", "Capacity", "Price", "Status", ""]} rows={5} cell={{ 4: PillCell }} />
      </section>
      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold">Upcoming events</h2>
        <DataTable headers={["Date", "Event", "Venue", "Client", "Status"]} rows={5} cell={{ 4: PillCell }} />
      </section>
    </LoadingShell>
  );
}
