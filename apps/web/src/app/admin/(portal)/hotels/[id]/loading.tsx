import { Skeleton } from "@/components/ui/skeleton";
import {
  DataTable,
  DetailHead,
  Fields,
  LoadingShell,
  PillCell,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function HotelLoading() {
  return (
    <LoadingShell label="hotel">
      <DetailHead back="x" actions={["w-28","w-28"]} />
      <Section title="Partner"><Fields cols={2} labels={["Business","Contact","Phone"]} /></Section>
      <Section title="Photos &amp; media"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => (<Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />))}</div></Section>
      <section className="space-y-3"><h2 className="font-heading text-base font-semibold">Availability</h2><Skeleton className="h-48 w-full rounded-xl" /></section>
      <section className="space-y-3"><h2 className="font-heading text-base font-semibold">Rooms</h2><DataTable headers={["Room","Sleeps","Rate","Units","Status","Actions"]} rows={4} cell={{ 4: PillCell }} /></section>
      <section className="space-y-3"><h2 className="font-heading text-base font-semibold">Bookings</h2><DataTable headers={["Guest","Room","Dates","Price","Status"]} rows={4} cell={{ 4: PillCell }} /></section>
    </LoadingShell>
  );
}
